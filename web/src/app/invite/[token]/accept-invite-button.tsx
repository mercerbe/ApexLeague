"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AcceptInviteResponse {
  accepted?: boolean;
  already_accepted?: boolean;
  league_id?: string;
  error?: string;
}

export function AcceptInviteButton({ token, leagueId }: { token: string; leagueId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });

      const payload = (await response.json()) as AcceptInviteResponse;

      if (!response.ok || !payload.accepted) {
        throw new Error(payload.error ?? "Unable to accept invite.");
      }

      router.push(`/league/${payload.league_id ?? leagueId}`);
      router.refresh();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept invite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleAccept}
        disabled={isSubmitting}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Accepting..." : "Accept Invite"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
