"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface InviteRecord {
  id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  token: string;
  expires_at: string;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  created_at: string;
  email_delivery_status: "sent" | "skipped" | "failed" | null;
  email_delivery_provider: string | null;
  email_delivery_provider_id: string | null;
  email_delivery_error: string | null;
  email_sent_at: string | null;
  last_delivery_attempt_at: string | null;
}

interface InviteHistoryResponse {
  invites?: InviteRecord[];
  error?: string;
}

export function InviteHistory({ leagueId }: { leagueId: string }) {
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);
  const [isResendingId, setIsResendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pendingCount = useMemo(() => invites.filter((invite) => invite.status === "pending").length, [invites]);

  const loadInvites = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/invites`, {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as InviteHistoryResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load invite history.");
      }

      setInvites(payload.invites ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invite history.");
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  async function handleRevoke(inviteId: string) {
    setIsRevokingId(inviteId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/invites`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          invite_id: inviteId,
          action: "revoke",
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to revoke invite.");
      }

      setInvites((current) => current.map((invite) => (invite.id === inviteId ? { ...invite, status: "revoked" } : invite)));
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke invite.");
    } finally {
      setIsRevokingId(null);
    }
  }

  async function handleResend(inviteId: string) {
    setIsResendingId(inviteId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/invites`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          invite_id: inviteId,
          action: "resend",
        }),
      });

      const payload = (await response.json()) as {
        invite?: InviteRecord;
        email_delivery?: { status: "sent" | "skipped" | "failed"; reason?: string; error?: string };
        error?: string;
      };

      if (!response.ok || !payload.invite) {
        throw new Error(payload.error ?? "Unable to resend invite.");
      }

      setInvites((current) => current.map((invite) => (invite.id === inviteId ? payload.invite! : invite)));

      if (payload.email_delivery?.status === "sent") {
        setNotice("Invite email sent.");
      } else if (payload.email_delivery?.status === "skipped") {
        setNotice(`Invite email skipped: ${payload.email_delivery.reason ?? "provider not configured"}`);
      } else if (payload.email_delivery?.status === "failed") {
        setNotice(`Invite email failed: ${payload.email_delivery.error ?? "unknown provider error"}`);
      } else {
        setNotice("Invite resent.");
      }
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Unable to resend invite.");
    } finally {
      setIsResendingId(null);
    }
  }

  async function handleCopyInviteLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    setError(null);

    try {
      await navigator.clipboard.writeText(link);
      setNotice("Invite link copied.");
    } catch {
      setNotice(link);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Invite History</h2>
          <p className="mt-1 text-sm text-neutral-600">Track pending, accepted, expired, and revoked invite links.</p>
        </div>
        <span className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{pendingCount} pending</span>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{notice}</p> : null}

      {isLoading ? <p className="mt-4 text-sm text-neutral-600">Loading invite history...</p> : null}

      {!isLoading && invites.length === 0 ? <p className="mt-4 text-sm text-neutral-600">No invites yet.</p> : null}

      {!isLoading && invites.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {invites.map((invite) => (
            <li key={invite.id} className="rounded-lg border border-neutral-200 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{invite.invitee_email}</p>
                  <p className="text-xs text-neutral-500">Created: {new Date(invite.created_at).toLocaleString()}</p>
                  <p className="text-xs text-neutral-500">Expires: {new Date(invite.expires_at).toLocaleString()}</p>
                  <p className="text-xs text-neutral-500">Token: {invite.token}</p>
                  <p className="text-xs text-neutral-500">
                    Email delivery: {invite.email_delivery_status ?? "not attempted"}
                    {invite.last_delivery_attempt_at ? ` • Last attempt ${new Date(invite.last_delivery_attempt_at).toLocaleString()}` : ""}
                  </p>
                  {invite.email_delivery_error ? <p className="text-xs text-red-600">Error: {invite.email_delivery_error}</p> : null}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      invite.status === "pending" ? "bg-amber-50 text-amber-800" : "",
                      invite.status === "accepted" ? "bg-green-50 text-green-700" : "",
                      invite.status === "expired" ? "bg-slate-100 text-slate-700" : "",
                      invite.status === "revoked" ? "bg-red-50 text-red-700" : "",
                    ].join(" ")}
                  >
                    {invite.status}
                  </span>

                  {invite.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(invite.token)}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
                      >
                        Copy Link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResend(invite.id)}
                        disabled={isResendingId === invite.id}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isResendingId === invite.id ? "Resending..." : "Resend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(invite.id)}
                        disabled={isRevokingId === invite.id}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRevokingId === invite.id ? "Revoking..." : "Revoke"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
