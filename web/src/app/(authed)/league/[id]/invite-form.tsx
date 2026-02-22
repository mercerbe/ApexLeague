"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

interface InviteResponse {
  invite?: {
    id: string;
    invitee_email: string;
    token: string;
    expires_at: string;
  };
  error?: string;
}

export function InviteForm({ leagueId }: { leagueId: string }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitePath, setInvitePath] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setInvitePath(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/invites`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          invitee_email: email,
        }),
      });

      const payload = (await response.json()) as InviteResponse;

      if (!response.ok || !payload.invite) {
        throw new Error(payload.error ?? "Unable to create invite.");
      }

      setSuccessMessage(`Invite created for ${payload.invite.invitee_email}`);
      setInvitePath(`/invite/${payload.invite.token}`);
      setEmail("");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create invite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Invite Member</h2>
      <p className="mt-1 text-sm text-neutral-600">Send an email invite token to add a member to this league.</p>

      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="driver@example.com"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Sending..." : "Create Invite"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {successMessage ? <p className="mt-3 text-sm text-green-700">{successMessage}</p> : null}
      {invitePath ? (
        <p className="mt-2 text-sm text-neutral-700">
          Invite link:{" "}
          <Link href={invitePath} className="font-medium underline">
            {invitePath}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
