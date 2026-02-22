"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/join`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to join league.");
      }

      router.refresh();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join league.");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleJoin}
        disabled={isJoining}
        className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isJoining ? "Joining..." : "Join League"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
