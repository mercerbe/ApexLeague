import { getServerEnv } from "@/lib/env";

export type InviteEmailDelivery =
  | { status: "sent"; provider: "resend"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; provider: "resend"; error: string };

interface SendLeagueInviteEmailInput {
  to: string;
  inviteUrl: string;
  leagueName: string;
  inviterDisplayName: string;
  expiresAtIso: string;
}

export async function sendLeagueInviteEmail(input: SendLeagueInviteEmailInput): Promise<InviteEmailDelivery> {
  const env = getServerEnv();
  const apiKey = env.RESEND_API_KEY;
  const from = env.INVITE_EMAIL_FROM;

  if (!apiKey) {
    return {
      status: "skipped",
      reason: "RESEND_API_KEY is not configured.",
    };
  }

  if (!from) {
    return {
      status: "skipped",
      reason: "INVITE_EMAIL_FROM is not configured.",
    };
  }

  const expiresAt = new Date(input.expiresAtIso).toLocaleString();
  const subject = `You're invited to join ${input.leagueName} on Apex League`;

  const text = [
    `You were invited by ${input.inviterDisplayName} to join "${input.leagueName}" on Apex League.`,
    `Accept invite: ${input.inviteUrl}`,
    `Invite expires: ${expiresAt}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin: 0 0 12px;">You're invited to Apex League</h2>
      <p><strong>${input.inviterDisplayName}</strong> invited you to join league <strong>${input.leagueName}</strong>.</p>
      <p>
        <a href="${input.inviteUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
          Accept Invite
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">If the button fails, use this link: ${input.inviteUrl}</p>
      <p style="font-size: 13px; color: #555;">Invite expires: ${expiresAt}</p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject,
        html,
        text,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!response.ok || !payload?.id) {
      return {
        status: "failed",
        provider: "resend",
        error: payload?.message ?? `Resend request failed with status ${response.status}.`,
      };
    }

    return {
      status: "sent",
      provider: "resend",
      id: payload.id,
    };
  } catch (error) {
    return {
      status: "failed",
      provider: "resend",
      error: error instanceof Error ? error.message : "Unexpected email provider error.",
    };
  }
}
