"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  country: string | null;
  circuit: string | null;
  venue_name: string | null;
  city: string | null;
  timezone: string | null;
  race_description: string | null;
  image_url: string | null;
  banner_url: string | null;
  poster_url: string | null;
  highlights_url: string | null;
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

interface ExistingBet {
  id: string;
  market_id: string;
  selection_key: string;
  stake: number;
  decimal_odds_snapshot: number;
  status: "pending" | "won" | "lost" | "void";
  placed_at: string;
  market: {
    selection_label: string;
    market_type: string;
  } | null;
}

interface MyBetsResponse {
  bankroll?: number;
  pending_stake?: number;
  remaining_tokens?: number;
  bets?: ExistingBet[];
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
  const [existingBets, setExistingBets] = useState<ExistingBet[]>([]);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(leagues[0]?.id ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExistingBets, setIsLoadingExistingBets] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalDraftStake = useMemo(() => {
    return Object.values(stakes).reduce((acc, value) => {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) {
        return acc;
      }

      return acc + amount;
    }, 0);
  }, [stakes]);

  const pendingStake = useMemo(
    () => existingBets.filter((bet) => bet.status === "pending").reduce((acc, bet) => acc + bet.stake, 0),
    [existingBets],
  );

  const remainingTokensBeforeDraft = useMemo(() => Number((100 - pendingStake).toFixed(2)), [pendingStake]);
  const remainingTokensAfterDraft = useMemo(
    () => Number((100 - (pendingStake + totalDraftStake)).toFixed(2)),
    [pendingStake, totalDraftStake],
  );

  const loadExistingBets = useCallback(async () => {
    if (!selectedLeagueId) {
      setExistingBets([]);
      return;
    }

    setIsLoadingExistingBets(true);

    try {
      const response = await fetch(`/api/races/${raceId}/bets/me?league_id=${selectedLeagueId}`, {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as MyBetsResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load your bets for this race.");
      }

      setExistingBets(payload.bets ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your bets for this race.");
    } finally {
      setIsLoadingExistingBets(false);
    }
  }, [raceId, selectedLeagueId]);

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

  useEffect(() => {
    loadExistingBets();
  }, [loadExistingBets]);

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

    if (pendingStake + totalDraftStake > 100) {
      setError(
        `You have ${remainingTokensBeforeDraft.toFixed(2)} tokens remaining for this race. Reduce draft stake before placing bets.`,
      );
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
        `Placed ${payload.accepted_bets?.length ?? 0} bet(s). Remaining tokens this race: ${payload.remaining_points ?? "n/a"}`,
      );
      setStakes({});
      await loadExistingBets();
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
          Each race starts with 100 tokens. Distribute them across available markets before lock at{" "}
          {race ? new Date(race.lock_time).toLocaleString() : "-"}.
        </p>
      </header>

      {race ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div>
              <p className="text-sm text-neutral-700">
                Round {race.round} • Season {race.season}
              </p>
              <p className="mt-1 text-sm text-neutral-700">
                {race.country ?? "Unknown country"}
                {race.city ? ` • ${race.city}` : ""}
                {race.circuit ? ` • ${race.circuit}` : race.venue_name ? ` • ${race.venue_name}` : ""}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Start: {new Date(race.start_time).toLocaleString()}
                {race.timezone ? ` (${race.timezone})` : ""}
              </p>
              {race.race_description ? <p className="mt-3 line-clamp-4 text-sm text-neutral-700">{race.race_description}</p> : null}
              {race.highlights_url ? (
                <a href={race.highlights_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-red-700 hover:underline">
                  Watch race highlights
                </a>
              ) : null}
            </div>

            {race.image_url || race.banner_url || race.poster_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={race.image_url ?? race.banner_url ?? race.poster_url ?? ""}
                alt={`${race.name} artwork`}
                className="h-40 w-full rounded-xl border border-neutral-200 object-cover"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p> : null}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_220px_180px] md:items-end">
          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-700">League</span>
            <select
              value={selectedLeagueId}
              onChange={(event) => {
                setSelectedLeagueId(event.target.value);
                setStakes({});
              }}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name} ({league.role})
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
            Placed: {pendingStake.toFixed(2)} / 100
          </div>

          <div
            className={`rounded-lg px-3 py-2 text-sm ${remainingTokensAfterDraft < 0 ? "bg-red-100 text-red-700" : "bg-neutral-100 text-neutral-700"}`}
          >
            Draft: {totalDraftStake.toFixed(2)} • Remaining after submit: {remainingTokensAfterDraft.toFixed(2)}
          </div>

          <button
            type="button"
            onClick={handlePlaceBets}
            disabled={isSubmitting || totalDraftStake <= 0 || remainingTokensAfterDraft < 0}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Placing..." : "Place Bets"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Your Bets (Selected League)</h2>

        {isLoadingExistingBets ? <p className="mt-4 text-sm text-neutral-600">Loading your race bets...</p> : null}

        {!isLoadingExistingBets && existingBets.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No bets placed for this race yet in the selected league.</p>
        ) : null}

        {!isLoadingExistingBets && existingBets.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {existingBets.map((bet) => (
              <li key={bet.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{bet.market?.selection_label ?? bet.selection_key}</p>
                  <p className="text-xs text-neutral-500">{bet.market?.market_type ?? "market"}</p>
                  <p className="text-xs text-neutral-500">Placed: {new Date(bet.placed_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-neutral-900">Stake {bet.stake.toFixed(2)}</span>
                  <span className="text-sm text-neutral-700">Odds {bet.decimal_odds_snapshot.toFixed(2)}</span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{bet.status}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
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
