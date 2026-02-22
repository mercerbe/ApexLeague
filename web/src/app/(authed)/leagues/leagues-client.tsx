"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface LeagueSummary {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  season: number;
  created_at: string;
}

interface CreateLeaguePayload {
  name: string;
  description?: string;
  icon_url?: string;
  visibility: "public" | "private";
  season: number;
}

const defaultLeaguePayload: CreateLeaguePayload = {
  name: "",
  description: "",
  icon_url: "",
  visibility: "public",
  season: 2026,
};

export function LeaguesClient() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [joiningLeagueId, setJoiningLeagueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateLeaguePayload>(defaultLeaguePayload);

  const publicLeagueCount = useMemo(() => leagues.length, [leagues]);

  useEffect(() => {
    let isMounted = true;

    async function loadLeagues() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/leagues?visibility=public", {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as { leagues?: LeagueSummary[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load leagues.");
        }

        if (isMounted) {
          setLeagues(payload.leagues ?? []);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leagues.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLeagues();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreateLeague(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as {
        league?: { id: string };
        error?: string;
      };

      if (!response.ok || !payload.league?.id) {
        throw new Error(payload.error ?? "Unable to create league.");
      }

      router.push(`/league/${payload.league.id}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create league.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinLeague(leagueId: string) {
    setJoiningLeagueId(leagueId);
    setError(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/join`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to join league.");
      }

      router.push(`/league/${leagueId}`);
      router.refresh();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join league.");
    } finally {
      setJoiningLeagueId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Leagues</h1>
        <p className="text-neutral-600">
          Create a new league or join one of {publicLeagueCount} public leagues available for the 2026 season.
        </p>
      </section>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <article className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Create League</h2>
          <form className="mt-4 space-y-4" onSubmit={handleCreateLeague}>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-neutral-700">League Name</span>
              <input
                required
                minLength={3}
                maxLength={80}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-neutral-700">Description</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2"
                maxLength={500}
                value={form.description ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-neutral-700">Icon URL (optional)</span>
              <input
                type="url"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={form.icon_url ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, icon_url: event.target.value }))}
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-neutral-700">Visibility</span>
                <select
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  value={form.visibility}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, visibility: event.target.value as "public" | "private" }))
                  }
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-neutral-700">Season</span>
                <input
                  type="number"
                  min={2026}
                  max={2100}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  value={form.season}
                  onChange={(event) => setForm((prev) => ({ ...prev, season: Number(event.target.value) }))}
                />
              </label>
            </div>

            <button
              disabled={isCreating}
              type="submit"
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create League"}
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Public Leagues</h2>

          {isLoading ? <p className="mt-4 text-neutral-600">Loading leagues...</p> : null}

          {!isLoading && leagues.length === 0 ? (
            <p className="mt-4 text-neutral-600">No public leagues found yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {leagues.map((league) => (
                <li key={league.id} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-medium text-neutral-900">{league.name}</p>
                      <p className="text-sm text-neutral-500">Season {league.season}</p>
                      {league.description ? <p className="mt-1 text-sm text-neutral-700">{league.description}</p> : null}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleJoinLeague(league.id)}
                        disabled={joiningLeagueId === league.id}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {joiningLeagueId === league.id ? "Joining..." : "Join"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
