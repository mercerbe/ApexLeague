import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/profile/ensure-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  handle: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).nullable(),
  bio: z.string().trim().max(280).nullable(),
  avatar_url: z.string().trim().url().nullable(),
});

interface ProfileRecord {
  id: string;
  handle: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeInput(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireAuthedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null as null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user, error: null as NextResponse<unknown> | null };
}

export async function GET() {
  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserProfile(auth.supabase, auth.user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile bootstrap failed" }, { status: 500 });
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id, handle, bio, avatar_url, created_at, updated_at")
    .eq("id", auth.user.id)
    .single<ProfileRecord>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Profile not found." }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof updateProfileSchema>;

  try {
    const json = await request.json();
    payload = updateProfileSchema.parse({
      handle: normalizeInput((json as Record<string, unknown>)?.handle),
      bio: normalizeInput((json as Record<string, unknown>)?.bio),
      avatar_url: normalizeInput((json as Record<string, unknown>)?.avatar_url),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    await ensureUserProfile(auth.supabase, auth.user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile bootstrap failed" }, { status: 500 });
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .update({
      handle: payload.handle,
      bio: payload.bio,
      avatar_url: payload.avatar_url,
    })
    .eq("id", auth.user.id)
    .select("id, handle, bio, avatar_url, created_at, updated_at")
    .single<ProfileRecord>();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Handle is already taken." }, { status: 409 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
