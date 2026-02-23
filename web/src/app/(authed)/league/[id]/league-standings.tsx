"use client";

import { useEffect, useMemo, useState } from "react";

interface StandingRow {
  user_id: string;
  role: "owner" | "admin" | "member";
  season_points: number;
  handle: string | null;
  avatar_url: string | null;
  rank: number;
  points_from_leader: number;
}

interface StandingsResponse {
  standings?: StandingRow[];
  error?: string;
}

function initialsFromHandle(handle: string | null, fallback: string) {
  const source = handle?.trim() || fallback.slice(0, 8);
  return source.slice(0, 2).toUpperCase();
}

export function LeagueStandings({ leagueId, isMember }: { leagueId: string; isMember: boolean }) {
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [isLoading, setIsLoading] = useState(isMember);
  const [error, setError] = useState<string | null>(null);

  const leaderPoints = useMemo(() => rows[0]?.season_points ?? 0, [rows]);

  useEffect(() => {
    let mounted = true;

    async function loadStandings() {
      if (!isMember) {
        setIsLoading(false);
        return;
      }

      setError(null);

      try {
        const response = await fetch(`/api/leagues/${leagueId}/standings`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as StandingsResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load standings.");
        }

        if (mounted) {
          setRows(payload.standings ?? []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load standings.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadStandings();

    return () => {
      mounted = false;
    };
  }, [leagueId, isMember]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Standings</h2>
          <p className="mt-1 text-sm text-neutral-600">Current league leaderboard by season points.</p>
        </div>
        <span className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{rows.length} members</span>
      </div>

      {!isMember ? <p className="mt-4 text-sm text-neutral-600">Join this league to view standings.</p> : null}
      {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {isMember && isLoading ? <p className="mt-4 text-sm text-neutral-600">Loading standings...</p> : null}

      {isMember && !isLoading && rows.length === 0 ? <p className="mt-4 text-sm text-neutral-600">No members yet.</p> : null}

      {isMember && !isLoading && rows.length > 0 ? (
        <ol className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                  {row.rank}
                </span>
                {row.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.avatar_url}
                    alt={row.handle ? `${row.handle} avatar` : "User avatar"}
                    className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 object-cover"
                  />
                ) : (
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
                    {initialsFromHandle(row.handle, row.user_id)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{row.handle ?? row.user_id.slice(0, 8)}</p>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">{row.role}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-neutral-900">{row.season_points.toFixed(2)} pts</p>
                <p className="text-xs text-neutral-500">
                  {row.points_from_leader === 0 ? "Leader" : `${row.points_from_leader.toFixed(2)} behind`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {isMember && !isLoading && rows.length > 0 ? (
        <p className="mt-4 text-xs text-neutral-500">Leader score: {leaderPoints.toFixed(2)} points</p>
      ) : null}
    </section>
  );
}
