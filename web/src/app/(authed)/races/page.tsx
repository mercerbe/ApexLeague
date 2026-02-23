import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface RaceRecord {
  id: string;
  season: number;
  round: number;
  name: string;
  country: string | null;
  circuit: string | null;
  start_time: string;
  lock_time: string;
  status: "scheduled" | "locked" | "settling" | "settled";
}

export default async function RacesPage() {
  const season = new Date().getUTCFullYear();
  const supabase = await createSupabaseServerClient();

  const { data: races, error } = await supabase
    .from("races")
    .select("id, season, round, name, country, circuit, start_time, lock_time, status")
    .eq("season", season)
    .order("start_time", { ascending: true })
    .returns<RaceRecord[]>();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Races</h1>
        <p className="mt-2 text-neutral-600">Browse the official F1 season schedule and place bets before each race lock time.</p>
      </header>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      ) : null}

      {!error && (!races || races.length === 0) ? (
        <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
          No races found for the {season} season yet.
        </p>
      ) : null}

      {races && races.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {races.map((race) => (
            <li key={race.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">Round {race.round}</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-900">{race.name}</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {race.country ?? "Unknown country"}
                {race.circuit ? ` • ${race.circuit}` : ""}
              </p>
              <p className="mt-2 text-xs text-neutral-500">Start: {new Date(race.start_time).toLocaleString()}</p>
              <p className="text-xs text-neutral-500">Lock: {new Date(race.lock_time).toLocaleString()}</p>

              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{race.status}</span>
                <Link
                  href={`/races/${race.id}/bets`}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Open Markets
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
