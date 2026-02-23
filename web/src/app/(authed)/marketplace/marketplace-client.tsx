"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SortMode = "total_points" | "member_count";

interface TopMember {
  rank: number;
  user_id: string;
  role: "owner" | "admin" | "member";
  season_points: number;
  handle: string | null;
  avatar_url: string | null;
}

interface LeagueMarketplaceEntry {
  id: string;
  name: string;
  description: string | null;
  season: number;
  member_count: number;
  total_points: number;
  top_members: TopMember[];
}

interface MarketplaceResponse {
  leagues?: LeagueMarketplaceEntry[];
  error?: string;
}

function displayMemberName(member: TopMember) {
  return member.handle?.trim() || member.user_id.slice(0, 8);
}

export function MarketplaceClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [season, setSeason] = useState(new Date().getUTCFullYear());
  const [sortMode, setSortMode] = useState<SortMode>("total_points");
  const [leagues, setLeagues] = useState<LeagueMarketplaceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadMarketplace() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/league-marketplace?season=${season}&limit=100`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as MarketplaceResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load league marketplace.");
        }

        if (mounted) {
          setLeagues(payload.leagues ?? []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load league marketplace.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadMarketplace();

    return () => {
      mounted = false;
    };
  }, [season]);

  const sortedLeagues = useMemo(() => {
    const rows = [...leagues];

    if (sortMode === "member_count") {
      rows.sort((a, b) => {
        if (b.member_count === a.member_count) {
          return b.total_points - a.total_points;
        }

        return b.member_count - a.member_count;
      });
      return rows;
    }

    rows.sort((a, b) => {
      if (b.total_points === a.total_points) {
        return b.member_count - a.member_count;
      }

      return b.total_points - a.total_points;
    });
    return rows;
  }, [leagues, sortMode]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,#ffeab6_0%,transparent_38%),radial-gradient(circle_at_85%_10%,#ffd1a8_0%,transparent_36%),linear-gradient(170deg,#f7f6f3_0%,#ebe9e2_45%,#dfddd5_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-neutral-300/70 bg-white/70 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">Public League Discovery</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">Leagues Hub</h1>
          <p className="mt-2 max-w-2xl text-neutral-700">
            Compare public leagues by aggregate performance, member depth, and top participants. Season-wide bragging rights.
          </p>
        </header>

        {!isAuthenticated ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Leagues Hub is visible in read-only mode. Sign in to open leagues and participate.
            <a href="/auth/login?next=/marketplace" className="ml-2 font-semibold underline">
              Sign in
            </a>
          </section>
        ) : null}

        <section className="rounded-2xl border border-neutral-300/70 bg-white/75 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="grid gap-4 md:grid-cols-[180px_220px_1fr] md:items-end">
            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-700">Season</span>
              <input
                type="number"
                min={2026}
                max={2100}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
                value={season}
                onChange={(event) => setSeason(Number(event.target.value || new Date().getUTCFullYear()))}
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-neutral-700">Sort by</span>
              <select
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="total_points">Total points</option>
                <option value="member_count">Member count</option>
              </select>
            </label>

            <div className="text-sm text-neutral-700">Showing {sortedLeagues.length} public leagues.</div>
          </div>
        </section>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {isLoading ? (
          <p className="rounded-lg border border-neutral-300/70 bg-white/75 px-4 py-3 text-sm text-neutral-700 shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur">
            Loading leagues hub...
          </p>
        ) : null}

        {!isLoading && sortedLeagues.length === 0 ? (
          <p className="rounded-lg border border-neutral-300/70 bg-white/75 px-4 py-3 text-sm text-neutral-700 shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur">
            No public leagues found for season {season}.
          </p>
        ) : null}

        {!isLoading && sortedLeagues.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {sortedLeagues.map((league, index) => (
              <li
                key={league.id}
                className="rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">Rank #{index + 1}</p>
                  {isAuthenticated ? (
                    <Link
                      href={`/league/${league.id}`}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      Open League
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-neutral-200 bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-500"
                    >
                      Sign in to open
                    </button>
                  )}
                </div>

                <h2 className="mt-2 text-xl font-semibold text-neutral-900">{league.name}</h2>
                <p className="mt-1 text-sm text-neutral-700">{league.description ?? "No description yet."}</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-neutral-100/80 px-3 py-2">
                    <p className="text-xs text-neutral-500">Total points</p>
                    <p className="text-sm font-semibold text-neutral-900">{league.total_points.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg bg-neutral-100/80 px-3 py-2">
                    <p className="text-xs text-neutral-500">Members</p>
                    <p className="text-sm font-semibold text-neutral-900">{league.member_count}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">Top Participants</p>
                  {league.top_members.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-600">No standings yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {league.top_members.map((member) => (
                        <li key={member.user_id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
                              {member.rank}
                            </span>
                            <span className="truncate text-sm text-neutral-800">{displayMemberName(member)}</span>
                            <span className="text-[10px] uppercase tracking-wide text-neutral-500">{member.role}</span>
                          </div>
                          <span className="text-sm font-semibold text-neutral-900">{member.season_points.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
}
