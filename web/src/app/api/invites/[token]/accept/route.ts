import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/profile/ensure-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

interface InviteRecord {
  id: string;
  league_id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_by_user_id: string | null;
  league: { name: string } | null;
}

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  const parsedParams = z.object({ token: z.string().uuid() }).safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid invite token." }, { status: 400 });
  }

  const { token } = parsedParams.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "Authenticated user does not have an email." }, { status: 400 });
  }

  try {
    await ensureUserProfile(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile bootstrap failed" }, { status: 500 });
  }

  let service;

  try {
    service = createSupabaseServiceRoleClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Service client unavailable" }, { status: 500 });
  }

  const { data: invite, error: inviteError } = await service
    .from("league_invites")
    .select("id, league_id, invitee_email, status, expires_at, accepted_by_user_id, league:leagues(name)")
    .eq("token", token)
    .maybeSingle<InviteRecord>();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const userEmail = user.email.toLowerCase();
  const inviteEmail = invite.invitee_email.toLowerCase();

  if (inviteEmail !== userEmail) {
    return NextResponse.json({ error: "This invite was issued to a different email address." }, { status: 403 });
  }

  const now = new Date();
  const expiresAt = new Date(invite.expires_at);

  if (invite.status === "accepted") {
    if (invite.accepted_by_user_id === user.id) {
      return NextResponse.json({ accepted: true, already_accepted: true, league_id: invite.league_id });
    }

    return NextResponse.json({ error: "Invite already accepted by another user." }, { status: 409 });
  }

  if (invite.status !== "pending") {
    return NextResponse.json({ error: `Invite is ${invite.status}.` }, { status: 409 });
  }

  if (expiresAt.getTime() <= now.getTime()) {
    await service.from("league_invites").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
    return NextResponse.json({ error: "Invite has expired." }, { status: 410 });
  }

  const { error: memberError } = await service.from("league_members").upsert(
    {
      league_id: invite.league_id,
      user_id: user.id,
      role: "member",
    },
    {
      onConflict: "league_id,user_id",
      ignoreDuplicates: true,
    },
  );

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const acceptedAt = now.toISOString();
  const { data: acceptedInvite, error: acceptError } = await service
    .from("league_invites")
    .update({
      status: "accepted",
      accepted_by_user_id: user.id,
      accepted_at: acceptedAt,
    })
    .eq("id", invite.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (acceptError) {
    return NextResponse.json({ error: acceptError.message }, { status: 500 });
  }

  if (!acceptedInvite) {
    const { data: latestInvite } = await service
      .from("league_invites")
      .select("status, accepted_by_user_id")
      .eq("id", invite.id)
      .maybeSingle();

    if (latestInvite?.status === "accepted" && latestInvite.accepted_by_user_id === user.id) {
      return NextResponse.json({ accepted: true, already_accepted: true, league_id: invite.league_id });
    }

    return NextResponse.json({ error: "Invite state changed; please retry." }, { status: 409 });
  }

  return NextResponse.json({
    accepted: true,
    league_id: invite.league_id,
    league_name: invite.league?.name ?? null,
  });
}
