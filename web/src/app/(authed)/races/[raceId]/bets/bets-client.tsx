"use client";

import { useEffect, useMemo, useState } from "react";

interface LeagueOption {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
}

interface RaceSummary {
  id: string;
  name: string;
  season: number;
  round: number;
  status: "scheduled" | "locked" | "settling" | "settled";
  lock_time: string;
  start_time: string;
}

interface MarketRecord {
  id: string;
  selection_label: string;
  selection_key: string;
  market_type: string;
  decimal_odds: number | string;
  is_active: boolean;
}

interface MarketsResponse {
  race?: RaceSummary;
  markets?: MarketRecord[];
  error?: string;
}

interface PlaceBetsResponse {
  race_id?: string;
  league_id?: string;
  accepted_bets?: Array<{
    bet_id: string;
    market_id: string;
    selection_key: string;
    stake: number;
    decimal_odds_snapshot: number;
    status: string;
  }>;
  remaining_points?: number;
  error?: string;
}

function asNumber(value: string | number) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function BetsClient({ raceId, leagues }: { raceId: string; leagues: LeagueOption[] }) {
  const [race, setRace] = useState<RaceSummary | null>(null);
  const [markets, setMarkets] = useState<MarketRecord[]>([]);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(leagues[0]?.id ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalStake = useMemo(() => {
    return Object.values(stakes).reduce((acc, value) => {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) {
        return acc;
      }

      return acc + amount;
    }, 0);
  }, [stakes]);

  useEffect(() => {
    let mounted = true;

    async function loadMarkets() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/races/${raceId}/markets`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as MarketsResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load markets.");
        }

        if (!mounted) {
          return;
        }

        setRace(payload.race ?? null);
        setMarkets(payload.markets ?? []);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load markets.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadMarkets();

    return () => {
      mounted = false;
    };
  }, [raceId]);

  async function handlePlaceBets() {
    setError(null);
    setSuccess(null);

    const bets = Object.entries(stakes)
      .map(([market_id, stakeValue]) => ({
        market_id,
        stake: Number(stakeValue),
      }))
      .filter((bet) => Number.isFinite(bet.stake) && bet.stake > 0);

    if (bets.length === 0) {
      setError("Enter a stake for at least one market.");
      return;
    }

    if (!selectedLeagueId) {
      setError("Select a league before placing bets.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/races/${raceId}/bets`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          league_id: selectedLeagueId,
          bets,
        }),
      });

      const payload = (await response.json()) as PlaceBetsResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to place bets.");
      }

      setSuccess(
        `Placed ${payload.accepted_bets?.length ?? 0} bet(s). Remaining points this race: ${payload.remaining_points ?? "n/a"}`,
      );
      setStakes({});
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to place bets.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{race?.name ?? "Race Markets"}</h1>
        <p className="mt-2 text-neutral-600">
          Allocate up to 100 points for this race. Markets lock at {race ? new Date(race.lock_time).toLocaleString() : "-"}.
        </p>
      </header>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p> : null}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_180px] md:items-end">
          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-700">League</span>
            <select
              value={selectedLeagueId}
              onChange={(event) => setSelectedLeagueId(event.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name} ({league.role})
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">Total stake: {totalStake.toFixed(2)} / 100</div>

          <button
            type="button"
            onClick={handlePlaceBets}
            disabled={isSubmitting || totalStake <= 0}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Placing..." : "Place Bets"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Available Markets</h2>

        {isLoading ? <p className="mt-4 text-sm text-neutral-600">Loading markets...</p> : null}

        {!isLoading && markets.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No active markets are available for this race yet.</p>
        ) : null}

        {!isLoading && markets.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {markets.map((market) => (
              <li key={market.id} className="grid gap-3 rounded-lg border border-neutral-200 px-3 py-3 md:grid-cols-[1fr_170px_120px] md:items-center">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{market.selection_label}</p>
                  <p className="text-xs text-neutral-500">
                    {market.market_type} • {market.selection_key}
                  </p>
                </div>

                <p className="text-sm font-semibold text-neutral-800">Odds: {asNumber(market.decimal_odds).toFixed(2)}</p>

                <input
                  inputMode="decimal"
                  placeholder="Stake"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  value={stakes[market.id] ?? ""}
                  onChange={(event) => setStakes((current) => ({ ...current, [market.id]: event.target.value }))}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
