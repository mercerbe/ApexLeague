import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/profile/ensure-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface PostgresError {
  code?: string;
  message: string;
}

export async function POST(_request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const parsedParams = z.object({ leagueId: z.string().uuid() }).safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  const { leagueId } = parsedParams.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserProfile(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile bootstrap failed" }, { status: 500 });
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, visibility")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { error: joinError } = await supabase.from("league_members").insert({
    league_id: leagueId,
    user_id: user.id,
    role: "member",
  });

  if (joinError) {
    const typedError = joinError as PostgresError;

    if (typedError.code === "23505") {
      return NextResponse.json({ joined: true, already_member: true, league_id: leagueId });
    }

    if (typedError.code === "42501") {
      return NextResponse.json({ error: "You do not have permission to join this league." }, { status: 403 });
    }

    return NextResponse.json({ error: typedError.message }, { status: 500 });
  }

  return NextResponse.json({ joined: true, league_id: leagueId });
}
