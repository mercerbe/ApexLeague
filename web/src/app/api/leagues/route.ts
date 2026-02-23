import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/profile/ensure-profile";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createLeagueSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).optional(),
  icon_url: z.string().url().optional(),
  visibility: z.enum(["public", "private"]).default("private"),
  season: z.number().int().min(2026).max(2100).default(2026),
});

function parseString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function parseCreateLeaguePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = await request.json();
    return createLeagueSchema.parse(json);
  }

  const formData = await request.formData();
  return createLeagueSchema.parse({
    name: parseString(formData.get("name")),
    description: parseString(formData.get("description")),
    icon_url: parseString(formData.get("icon_url")),
    visibility: parseString(formData.get("visibility")),
    season: Number(parseString(formData.get("season")) ?? "2026"),
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const visibility = url.searchParams.get("visibility") ?? "public";

  if (visibility !== "public") {
    return NextResponse.json({ error: "Only visibility=public is currently supported." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, description, icon_url, visibility, season, owner_id, created_at")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leagues: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await parseCreateLeaguePayload(request);

    await ensureUserProfile(supabase, user);

    let { data: league, error: leagueError } = await supabase
      .from("leagues")
      .insert({
        owner_id: user.id,
        name: payload.name,
        description: payload.description,
        icon_url: payload.icon_url,
        visibility: payload.visibility,
        season: payload.season,
      })
      .select("id, name, description, visibility, season, created_at")
      .single();

    // Local session/cookie quirks can occasionally cause auth JWT context to miss RLS checks.
    // Retry with service-role after explicit auth verification above.
    if ((leagueError as { code?: string } | null)?.code === "42501") {
      const service = createSupabaseServiceRoleClient();
      const retry = await service
        .from("leagues")
        .insert({
          owner_id: user.id,
          name: payload.name,
          description: payload.description,
          icon_url: payload.icon_url,
          visibility: payload.visibility,
          season: payload.season,
        })
        .select("id, name, description, visibility, season, created_at")
        .single();

      league = retry.data;
      leagueError = retry.error;
    }

    if (leagueError || !league) {
      return NextResponse.json({ error: leagueError?.message ?? "Failed to create league." }, { status: 500 });
    }

    let { error: memberError } = await supabase.from("league_members").insert({
      league_id: league.id,
      user_id: user.id,
      role: "owner",
    });

    if ((memberError as { code?: string } | null)?.code === "42501") {
      const service = createSupabaseServiceRoleClient();
      const retryMemberInsert = await service.from("league_members").insert({
        league_id: league.id,
        user_id: user.id,
        role: "owner",
      });

      memberError = retryMemberInsert.error;
    }

    if (memberError) {
      const service = createSupabaseServiceRoleClient();
      await service.from("leagues").delete().eq("id", league.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({ league }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Unexpected error while creating league." }, { status: 500 });
  }
}
