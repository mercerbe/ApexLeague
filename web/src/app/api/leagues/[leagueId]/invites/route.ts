import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/profile/ensure-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createInviteSchema = z.object({
  invitee_email: z.string().trim().email(),
  expires_in_days: z.number().int().min(1).max(30).default(7),
});

interface PostgresError {
  code?: string;
  message: string;
}

export async function POST(request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const parsedParams = z.object({ leagueId: z.string().uuid() }).safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  const { leagueId } = parsedParams.data;

  let payload: z.infer<typeof createInviteSchema>;

  try {
    const json = await request.json();
    payload = createInviteSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

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

  const expiresAt = new Date(Date.now() + payload.expires_in_days * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: inviteError } = await supabase
    .from("league_invites")
    .insert({
      league_id: leagueId,
      inviter_id: user.id,
      invitee_email: payload.invitee_email.toLowerCase(),
      token: randomUUID(),
      expires_at: expiresAt,
      status: "pending",
    })
    .select("id, league_id, invitee_email, status, token, expires_at, created_at")
    .single();

  if (inviteError || !invite) {
    const typedError = inviteError as PostgresError | null;

    if (typedError?.code === "42501") {
      return NextResponse.json({ error: "Only league owner/admin can create invites." }, { status: 403 });
    }

    return NextResponse.json({ error: typedError?.message ?? "Failed to create invite." }, { status: 500 });
  }

  return NextResponse.json({ invite }, { status: 201 });
}
