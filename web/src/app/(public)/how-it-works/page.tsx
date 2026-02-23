import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const displayFont = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

interface RaceRow {
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

interface MarketRow {
  id: string;
  market_type: string;
  selection_label: string;
  decimal_odds: number | string;
  is_active: boolean;
}

function toNumber(value: number | string) {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function HowItWorksPage() {
  const supabase = await createSupabaseServerClient();
  const currentSeason = new Date().getUTCFullYear();
  const nowIso = new Date().toISOString();

  const upcomingQuery = await supabase
    .from("races")
    .select("id, season, round, name, country, circuit, start_time, lock_time, status")
    .eq("season", currentSeason)
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(12)
    .returns<RaceRow[]>();

  let races = upcomingQuery.data ?? [];
  if (!races.length) {
    const fallback = await supabase
      .from("races")
      .select("id, season, round, name, country, circuit, start_time, lock_time, status")
      .eq("season", currentSeason)
      .order("start_time", { ascending: true })
      .limit(12)
      .returns<RaceRow[]>();
    races = fallback.data ?? [];
  }

  const nextRace = races[0] ?? null;
  let marketRows: MarketRow[] = [];

  if (nextRace) {
    const markets = await supabase
      .from("markets")
      .select("id, market_type, selection_label, decimal_odds, is_active")
      .eq("race_id", nextRace.id)
      .eq("is_active", true)
      .order("market_type", { ascending: true })
      .order("selection_label", { ascending: true })
      .limit(20)
      .returns<MarketRow[]>();

    marketRows = markets.data ?? [];
  }

  const uniqueMarketTypes = [...new Set(marketRows.map((row) => row.market_type))];

  return (
    <main
      className={`${bodyFont.className} min-h-screen bg-[radial-gradient(circle_at_15%_20%,#ffeab6_0%,transparent_40%),radial-gradient(circle_at_85%_10%,#ffd1a8_0%,transparent_38%),linear-gradient(170deg,#f7f6f3_0%,#ebe9e2_45%,#dfddd5_100%)] text-neutral-900`}
    >
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="rounded-3xl border border-neutral-300/70 bg-white/70 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">Detailed Guide</p>
          <h1 className={`${displayFont.className} mt-3 text-6xl leading-[0.9] tracking-wide text-neutral-950 sm:text-7xl`}>
            HOW IT WORKS
          </h1>
          <p className="mt-4 max-w-3xl text-neutral-700">
            Apex League follows the Formula 1 race calendar, gives every user a 100-token budget per race and per league, and settles results
            automatically from finalized race outcomes.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/races" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
              View Races
            </a>
            <a href="/leagues" className="rounded-lg border border-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100">
              Open Leagues
            </a>
            <a href="/leaderboard" className="rounded-lg border border-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100">
              View Leaderboard
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
            <h2 className="text-xl font-semibold text-neutral-900">1. Formula 1 Schedule</h2>
            <p className="mt-2 text-sm text-neutral-700">
              The app uses the season race schedule in `races` (name, circuit, start time, lock time, status). Bets lock at each race&apos;s
              `lock_time`.
            </p>
            {races.length === 0 ? (
              <p className="mt-4 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600">
                No races are currently loaded for season {currentSeason}. Seed or ingest races to populate this schedule.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {races.slice(0, 6).map((race) => (
                  <li key={race.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
                    <p className="text-sm font-semibold text-neutral-900">
                      R{race.round} · {race.name}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {race.country ?? "Unknown country"}
                      {race.circuit ? ` • ${race.circuit}` : ""} • Lock {new Date(race.lock_time).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
            <h2 className="text-xl font-semibold text-neutral-900">2. Bet Markets From APIs</h2>
            <p className="mt-2 text-sm text-neutral-700">
              For each race, markets are ingested from provider APIs and stored in `markets` with `market_type`, `selection_label`, and decimal
              odds. You can split tokens across multiple markets.
            </p>
            {nextRace ? (
              <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-3">
                <p className="text-sm font-semibold text-neutral-900">Next Race Market Snapshot: {nextRace.name}</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Active market types: {uniqueMarketTypes.length ? uniqueMarketTypes.join(", ") : "none loaded"}.
                </p>
                <ul className="mt-3 space-y-2">
                  {marketRows.slice(0, 6).map((market) => (
                    <li key={market.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-neutral-800">{market.market_type}</p>
                        <p className="truncate text-xs text-neutral-600">{market.selection_label}</p>
                      </div>
                      <p className="text-xs font-semibold text-neutral-900">{toNumber(market.decimal_odds).toFixed(2)}x</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600">
                No upcoming race found to preview markets yet.
              </p>
            )}
            <p className="mt-3 text-xs text-neutral-600">
              Betting constraints: each user has max 100 total pending stake per race per league, race must be `scheduled`, and current time must
              be before `lock_time`.
            </p>
          </article>
        </div>

        <article className="mt-6 rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
          <h2 className="text-xl font-semibold text-neutral-900">3. Scoring And Net Points</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Settlement runs automatically after finalized results are ingested. Scoring is calculated from each bet&apos;s stake and odds snapshot:
          </p>
          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-950 p-4 text-xs text-neutral-100">
            <p>`won`: gross_return = stake * decimal_odds_snapshot</p>
            <p>`won`: net_profit = gross_return - stake</p>
            <p className="mt-2">`lost`: gross_return = 0</p>
            <p>`lost`: net_profit = -stake</p>
            <p className="mt-2">`void`: gross_return = stake</p>
            <p>`void`: net_profit = 0</p>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>`league_members.season_points` is incremented by each user&apos;s net profit per race.</li>
            <li>League winner per race is the highest net profit in that league (ties break by user id).</li>
            <li>Leaderboards are built from these season points across users and leagues.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
