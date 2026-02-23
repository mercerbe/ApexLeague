import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/profile/ensure-profile";
import { getServerEnv } from "@/lib/env";
import { sendLeagueInviteEmail } from "@/lib/email/send-league-invite-email";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createInviteSchema = z.object({
  invitee_email: z.string().trim().email(),
  expires_in_days: z.number().int().min(1).max(30).default(7),
});

interface PostgresError {
  code?: string;
  message: string;
}

const revokeInviteSchema = z.object({
  invite_id: z.string().uuid(),
  action: z.literal("revoke"),
});

const resendInviteSchema = z.object({
  invite_id: z.string().uuid(),
  action: z.literal("resend"),
});

const inviteActionSchema = z.union([revokeInviteSchema, resendInviteSchema]);

interface InviteRecord {
  id: string;
  league_id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  token: string;
  expires_at: string;
  created_at: string;
  email_delivery_status: "sent" | "skipped" | "failed" | null;
  email_delivery_provider: string | null;
  email_delivery_provider_id: string | null;
  email_delivery_error: string | null;
  email_sent_at: string | null;
  last_delivery_attempt_at: string | null;
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

export async function GET(_request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const parsedParams = z.object({ leagueId: z.string().uuid() }).safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  const { leagueId } = parsedParams.data;
  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("league_invites")
    .select(
      "id, invitee_email, status, token, expires_at, accepted_by_user_id, accepted_at, created_at, email_delivery_status, email_delivery_provider, email_delivery_provider_id, email_delivery_error, email_sent_at, last_delivery_attempt_at",
    )
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    const typedError = error as PostgresError;

    if (typedError.code === "42501") {
      return NextResponse.json({ error: "Only league owner/admin can view invites." }, { status: 403 });
    }

    return NextResponse.json({ error: typedError.message }, { status: 500 });
  }

  return NextResponse.json({ invites: data ?? [] });
}

async function attemptInviteDelivery(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  args: {
    invite: InviteRecord;
    leagueName: string;
    inviterDisplayName: string;
  },
) {
  const env = getServerEnv();
  const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${args.invite.token}`;

  const emailDelivery = await sendLeagueInviteEmail({
    to: args.invite.invitee_email,
    inviteUrl,
    leagueName: args.leagueName,
    inviterDisplayName: args.inviterDisplayName,
    expiresAtIso: args.invite.expires_at,
  });

  const nowIso = new Date().toISOString();
  const deliveryUpdate = {
    email_delivery_status: emailDelivery.status,
    email_delivery_provider: emailDelivery.status === "skipped" ? null : emailDelivery.provider,
    email_delivery_provider_id: emailDelivery.status === "sent" ? emailDelivery.id : null,
    email_delivery_error:
      emailDelivery.status === "failed" ? emailDelivery.error : emailDelivery.status === "skipped" ? emailDelivery.reason : null,
    email_sent_at: emailDelivery.status === "sent" ? nowIso : null,
    last_delivery_attempt_at: nowIso,
  };

  const { data: updatedInvite, error: updateError } = await supabase
    .from("league_invites")
    .update(deliveryUpdate)
    .eq("id", args.invite.id)
    .select(
      "id, league_id, invitee_email, status, token, expires_at, created_at, email_delivery_status, email_delivery_provider, email_delivery_provider_id, email_delivery_error, email_sent_at, last_delivery_attempt_at",
    )
    .single<InviteRecord>();

  return {
    inviteUrl,
    emailDelivery,
    updatedInvite: updatedInvite ?? args.invite,
    updateError,
  };
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

  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.user;

  try {
    await ensureUserProfile(auth.supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile bootstrap failed" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + payload.expires_in_days * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: inviteError } = await auth.supabase
    .from("league_invites")
    .insert({
      league_id: leagueId,
      inviter_id: user.id,
      invitee_email: payload.invitee_email.toLowerCase(),
      token: randomUUID(),
      expires_at: expiresAt,
      status: "pending",
    })
    .select(
      "id, league_id, invitee_email, status, token, expires_at, created_at, email_delivery_status, email_delivery_provider, email_delivery_provider_id, email_delivery_error, email_sent_at, last_delivery_attempt_at",
    )
    .single<InviteRecord>();

  if (inviteError || !invite) {
    const typedError = inviteError as PostgresError | null;

    if (typedError?.code === "42501") {
      return NextResponse.json({ error: "Only league owner/admin can create invites." }, { status: 403 });
    }

    return NextResponse.json({ error: typedError?.message ?? "Failed to create invite." }, { status: 500 });
  }

  const { data: leagueInfo } = await auth.supabase.from("leagues").select("name").eq("id", leagueId).maybeSingle<{ name: string }>();

  const { data: inviterProfile } = await auth.supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle<{ handle: string | null }>();

  const inviterDisplayName = inviterProfile?.handle?.trim() || user.email || user.id.slice(0, 8);
  const leagueName = leagueInfo?.name ?? "Apex League";

  const deliveryResult = await attemptInviteDelivery(auth.supabase, {
    invite,
    leagueName,
    inviterDisplayName,
  });

  return NextResponse.json(
    {
      invite: deliveryResult.updatedInvite,
      invite_url: deliveryResult.inviteUrl,
      email_delivery: deliveryResult.emailDelivery,
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const parsedParams = z.object({ leagueId: z.string().uuid() }).safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  const { leagueId } = parsedParams.data;
  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof inviteActionSchema>;

  try {
    const json = await request.json();
    payload = inviteActionSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload.action === "revoke") {
    const { data: updated, error } = await auth.supabase
      .from("league_invites")
      .update({ status: "revoked" })
      .eq("league_id", leagueId)
      .eq("id", payload.invite_id)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();

    if (error) {
      const typedError = error as PostgresError;

      if (typedError.code === "42501") {
        return NextResponse.json({ error: "Only league owner/admin can revoke invites." }, { status: 403 });
      }

      return NextResponse.json({ error: typedError.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "Invite not found or no longer pending." }, { status: 409 });
    }

    return NextResponse.json({ invite: updated });
  }

  const { data: invite, error: inviteFetchError } = await auth.supabase
    .from("league_invites")
    .select(
      "id, league_id, invitee_email, status, token, expires_at, created_at, email_delivery_status, email_delivery_provider, email_delivery_provider_id, email_delivery_error, email_sent_at, last_delivery_attempt_at",
    )
    .eq("league_id", leagueId)
    .eq("id", payload.invite_id)
    .maybeSingle<InviteRecord>();

  if (inviteFetchError) {
    const typedError = inviteFetchError as PostgresError;

    if (typedError.code === "42501") {
      return NextResponse.json({ error: "Only league owner/admin can resend invites." }, { status: 403 });
    }

    return NextResponse.json({ error: typedError.message }, { status: 500 });
  }

  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "Only pending invites can be resent." }, { status: 409 });
  }

  const { data: leagueInfo } = await auth.supabase.from("leagues").select("name").eq("id", leagueId).maybeSingle<{ name: string }>();

  const { data: inviterProfile } = await auth.supabase
    .from("profiles")
    .select("handle")
    .eq("id", auth.user.id)
    .maybeSingle<{ handle: string | null }>();

  const inviterDisplayName = inviterProfile?.handle?.trim() || auth.user.email || auth.user.id.slice(0, 8);
  const leagueName = leagueInfo?.name ?? "Apex League";

  const deliveryResult = await attemptInviteDelivery(auth.supabase, {
    invite,
    leagueName,
    inviterDisplayName,
  });

  return NextResponse.json({
    invite: deliveryResult.updatedInvite,
    invite_url: deliveryResult.inviteUrl,
    email_delivery: deliveryResult.emailDelivery,
  });
}
