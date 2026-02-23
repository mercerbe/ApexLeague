"use client";

import { useEffect, useState } from "react";

interface TrophyRow {
  race_id: string;
  race_name: string;
  round: number;
  season: number;
  race_start_time: string;
  winner_user_id: string;
  winner_handle: string | null;
  winner_avatar_url: string | null;
  race_points: number;
}

interface TrophyCaseResponse {
  trophies?: TrophyRow[];
  error?: string;
}

export function LeagueTrophyCase({ leagueId, isMember }: { leagueId: string; isMember: boolean }) {
  const [rows, setRows] = useState<TrophyRow[]>([]);
  const [isLoading, setIsLoading] = useState(isMember);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTrophies() {
      if (!isMember) {
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const response = await fetch(`/api/leagues/${leagueId}/trophy-case`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as TrophyCaseResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load trophy case.");
        }
        if (mounted) {
          setRows(payload.trophies ?? []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load trophy case.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadTrophies();

    return () => {
      mounted = false;
    };
  }, [leagueId, isMember]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Trophy Case</h2>
          <p className="mt-1 text-sm text-neutral-600">Race weekend winner in this league based on highest net tokens.</p>
        </div>
        <span className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{rows.length} trophies</span>
      </div>

      {!isMember ? <p className="mt-4 text-sm text-neutral-600">Join this league to view the trophy case.</p> : null}
      {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {isMember && isLoading ? <p className="mt-4 text-sm text-neutral-600">Loading trophy case...</p> : null}

      {isMember && !isLoading && rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">No race winners recorded yet for this league.</p>
      ) : null}

      {isMember && !isLoading && rows.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.race_id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    Round {row.round} · {row.race_name}
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    Winner: {row.winner_handle?.trim() || row.winner_user_id.slice(0, 8)} · {row.race_points.toFixed(2)} net tokens
                  </p>
                </div>
                <p className="text-xs text-neutral-500">{new Date(row.race_start_time).toLocaleDateString()}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
