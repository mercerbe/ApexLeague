"use client";

import { useEffect, useState } from "react";

interface UserRow {
  rank: number;
  user_id: string;
  handle: string | null;
  avatar_url: string | null;
  leagues_count: number;
  total_points: number;
}

interface LeagueRow {
  rank: number;
  league_id: string;
  league_name: string;
  visibility: "public" | "private";
  member_count: number;
  total_points: number;
  average_points_per_user: number;
}

interface LeaderboardPayload {
  season: number;
  top_users?: UserRow[];
  top_leagues?: LeagueRow[];
  error?: string;
}

function displayName(row: UserRow) {
  return row.handle?.trim() || row.user_id.slice(0, 8);
}

export function LeaderboardClient({ initialSeason }: { initialSeason: number }) {
  const [season, setSeason] = useState(initialSeason);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadLeaderboard() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/leaderboard?season=${season}&limit=50`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as LeaderboardPayload;
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load leaderboard.");
        }

        if (mounted) {
          setUsers(payload.top_users ?? []);
          setLeagues(payload.top_leagues ?? []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leaderboard.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      mounted = false;
    };
  }, [season]);

  const totalUserPoints = users.reduce((acc, row) => acc + row.total_points, 0);
  const totalLeaguePoints = leagues.reduce((acc, row) => acc + row.total_points, 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,#ffeab6_0%,transparent_38%),radial-gradient(circle_at_85%_10%,#ffd1a8_0%,transparent_36%),linear-gradient(170deg,#f7f6f3_0%,#ebe9e2_45%,#dfddd5_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-neutral-300/70 bg-white/70 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">Season Rankings</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">Leaderboard</h1>
          <p className="mt-2 max-w-3xl text-neutral-700">
            Rank users by net season tokens across public and private leagues, plus leagues by average points per member.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Tracked Users</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">{users.length}</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Tracked Leagues</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">{leagues.length}</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Total Points</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">{Math.max(totalUserPoints, totalLeaguePoints).toFixed(2)}</p>
            </article>
          </div>
        </header>

        <section className="rounded-2xl border border-neutral-300/70 bg-white/75 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur">
          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-700">Season</span>
            <input
              type="number"
              min={2026}
              max={2100}
              className="w-full max-w-[220px] rounded-lg border border-neutral-300 bg-white px-3 py-2"
              value={season}
              onChange={(event) => setSeason(Number(event.target.value || initialSeason))}
            />
          </label>
        </section>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {isLoading ? (
          <p className="rounded-lg border border-neutral-300/70 bg-white/75 px-4 py-3 text-sm text-neutral-700 shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur">
            Loading leaderboard...
          </p>
        ) : null}

        {!isLoading ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
              <h2 className="text-xl font-semibold text-neutral-900">Top Users</h2>
              <p className="mt-1 text-sm text-neutral-700">Net season tokens across all leagues (public and private).</p>

              {users.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-600">No user standings found for season {season}.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {users.map((row) => (
                    <li key={row.user_id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
                          {row.rank}
                        </span>
                        <span className="truncate text-sm text-neutral-900">{displayName(row)}</span>
                        <span className="text-[11px] text-neutral-500">{row.leagues_count} leagues</span>
                      </div>
                      <span className="text-sm font-semibold text-neutral-900">{row.total_points.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
              <h2 className="text-xl font-semibold text-neutral-900">Top Leagues</h2>
              <p className="mt-1 text-sm text-neutral-700">Ranked by average season points per member.</p>

              {leagues.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-600">No league standings found for season {season}.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {leagues.map((row) => (
                    <li key={row.league_id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
                            {row.rank}
                          </span>
                          <span className="truncate text-sm font-medium text-neutral-900">{row.league_name}</span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                            {row.visibility}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-neutral-900">{row.average_points_per_user.toFixed(2)} avg</span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {row.member_count} members • {row.total_points.toFixed(2)} total points
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        ) : null}
      </div>
    </main>
  );
}
