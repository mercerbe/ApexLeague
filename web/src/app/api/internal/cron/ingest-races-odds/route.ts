import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { isAuthorizedInternalRequest } from "@/lib/internal/auth";
import {
  fetchOddsApiEventOdds,
  fetchOddsApiEvents,
  marketTypeForOddsKey,
  selectionKeyForOutcome,
} from "@/lib/odds/the-odds-api";
import { fetchOpenF1RaceSessionsForSeason, sessionToRaceRow } from "@/lib/races/openf1-schedule";
import { eventToRaceRow, fetchSportsDbSeasonEvents } from "@/lib/races/thesportsdb";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const querySchema = z.object({
  season: z.coerce.number().int().min(2026).max(2100).default(new Date().getUTCFullYear()),
});

interface ExistingRaceRow {
  id: string;
  season: number;
  round: number;
  status: "scheduled" | "locked" | "settling" | "settled";
  result_revision: number;
  start_time: string;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestEventForRace(race: { name: string; country: string | null; start_time: string }, events: Array<{ id: string; commence_time: string; home_team?: string; away_team?: string }>) {
  const raceStartMs = new Date(race.start_time).getTime();
  const raceLabel = normalize(`${race.name} ${race.country ?? ""}`);

  const scored = events
    .map((event) => {
      const eventStartMs = new Date(event.commence_time).getTime();
      const deltaMs = Math.abs(eventStartMs - raceStartMs);
      const eventLabel = normalize(`${event.home_team ?? ""} ${event.away_team ?? ""}`);
      const overlap = raceLabel && eventLabel && (raceLabel.includes(eventLabel) || eventLabel.includes(raceLabel));
      const score = deltaMs + (overlap ? -6 * 60 * 60 * 1000 : 0);
      return { event, score };
    })
    .sort((a, b) => a.score - b.score);

  const candidate = scored[0]?.event ?? null;
  if (!candidate) {
    return null;
  }

  const diffHours = Math.abs(new Date(candidate.commence_time).getTime() - raceStartMs) / (1000 * 60 * 60);
  return diffHours <= 72 ? candidate : null;
}

export async function GET(request: Request) {
  const auth = isAuthorizedInternalRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "Unauthorized" ? 401 : 500 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    season: url.searchParams.get("season") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { season } = parsed.data;
  const env = getServerEnv();
  const service = createSupabaseServiceRoleClient();

  const { data: existingRaces, error: existingError } = await service
    .from("races")
    .select("id, season, round, status, result_revision, start_time")
    .eq("season", season)
    .returns<ExistingRaceRow[]>();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingByRound = new Map((existingRaces ?? []).map((race) => [race.round, race]));
  const sportsDbApiKey = env.THESPORTSDB_API_KEY ?? "123";
  const sportsDbLeagueId = env.THESPORTSDB_LEAGUE_ID ?? "4370";

  let scheduleProvider: "thesportsdb" | "openf1" = "thesportsdb";
  let raceRows: Array<Record<string, unknown>> = [];

  try {
    const sportsDbEvents = await fetchSportsDbSeasonEvents({
      apiKey: sportsDbApiKey,
      leagueId: sportsDbLeagueId,
      season,
    });

    raceRows = sportsDbEvents
      .map((event, index) => {
        const parsedRound = Number(event.intRound ?? "");
        const round = Number.isInteger(parsedRound) && parsedRound > 0 ? parsedRound : index + 1;

        return eventToRaceRow({
          season,
          fallbackRound: round,
          event,
          previousStatus: existingByRound.get(round)?.status,
          previousResultRevision: existingByRound.get(round)?.result_revision,
        });
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  } catch {
    raceRows = [];
  }

  if (raceRows.length === 0) {
    scheduleProvider = "openf1";
    const scheduleSessions = await fetchOpenF1RaceSessionsForSeason(season);

    raceRows = scheduleSessions
      .map((session, index) =>
        sessionToRaceRow({
          season,
          round: index + 1,
          session,
          previousStatus: existingByRound.get(index + 1)?.status,
          previousResultRevision: existingByRound.get(index + 1)?.result_revision,
        }),
      )
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  let scheduleUpserted = 0;
  if (raceRows.length > 0) {
    const { error: upsertScheduleError } = await service.from("races").upsert(raceRows, {
      onConflict: "season,round",
      ignoreDuplicates: false,
    });

    if (upsertScheduleError) {
      return NextResponse.json({ error: upsertScheduleError.message }, { status: 500 });
    }

    scheduleUpserted = raceRows.length;
  }

  const oddsApiKey = env.ODDS_API_KEY;
  if (!oddsApiKey) {
    return NextResponse.json({
      season,
      schedule_provider: scheduleProvider,
      schedule_upserted: scheduleUpserted,
      odds_ingested: false,
      message: "ODDS_API_KEY not configured. Schedule synced only.",
    });
  }

  const sportKey = env.ODDS_API_SPORT_KEY ?? "motorsport_f1";
  const regions = env.ODDS_API_REGIONS ?? "us";
  const markets = env.ODDS_API_MARKETS ?? "outrights";
  const preferredBookmaker = env.ODDS_API_BOOKMAKER;

  const [events, racesAfterUpsertResult] = await Promise.all([
    fetchOddsApiEvents({ apiKey: oddsApiKey, sportKey }),
    service
      .from("races")
      .select("id, name, country, start_time, status")
      .eq("season", season)
      .in("status", ["scheduled", "locked"])
      .returns<Array<{ id: string; name: string; country: string | null; start_time: string; status: string }>>(),
  ]);

  if (racesAfterUpsertResult.error) {
    return NextResponse.json({ error: racesAfterUpsertResult.error.message }, { status: 500 });
  }

  const candidateRaces = racesAfterUpsertResult.data ?? [];
  const oddsRows: Array<{
    race_id: string;
    provider: string;
    provider_market_id: string;
    market_type: string;
    selection_key: string;
    selection_label: string;
    decimal_odds: number;
    american_odds: number | null;
    is_active: boolean;
    fetched_at: string;
  }> = [];

  const raceMatches: Array<{ race_id: string; event_id?: string; markets_added: number; skipped_reason?: string }> = [];

  for (const race of candidateRaces) {
    const event = findBestEventForRace(race, events);
    if (!event) {
      raceMatches.push({ race_id: race.id, markets_added: 0, skipped_reason: "No matching odds event found" });
      continue;
    }

    let eventOdds;
    try {
      eventOdds = await fetchOddsApiEventOdds({
        apiKey: oddsApiKey,
        sportKey,
        eventId: event.id,
        regions,
        markets,
        bookmaker: preferredBookmaker,
      });
    } catch (error) {
      raceMatches.push({
        race_id: race.id,
        event_id: event.id,
        markets_added: 0,
        skipped_reason: error instanceof Error ? error.message : "Failed to fetch odds",
      });
      continue;
    }

    const bookmaker = preferredBookmaker
      ? (eventOdds.bookmakers ?? []).find((entry) => entry.key === preferredBookmaker)
      : (eventOdds.bookmakers ?? [])[0];

    if (!bookmaker) {
      raceMatches.push({ race_id: race.id, event_id: event.id, markets_added: 0, skipped_reason: "No bookmaker in response" });
      continue;
    }

    let added = 0;
    for (const market of bookmaker.markets ?? []) {
      const marketType = marketTypeForOddsKey(market.key);
      const providerMarketId = `${event.id}:${bookmaker.key}:${market.key}`;

      for (const outcome of market.outcomes ?? []) {
        if (!Number.isFinite(outcome.price) || outcome.price <= 1) {
          continue;
        }

        oddsRows.push({
          race_id: race.id,
          provider: "the-odds-api",
          provider_market_id: providerMarketId,
          market_type: marketType,
          selection_key: selectionKeyForOutcome(outcome.name, market.key),
          selection_label: outcome.name,
          decimal_odds: Number(outcome.price.toFixed(4)),
          american_odds: null,
          is_active: true,
          fetched_at: market.last_update ?? new Date().toISOString(),
        });
        added += 1;
      }
    }

    raceMatches.push({ race_id: race.id, event_id: event.id, markets_added: added });
  }

  const matchedRaceIds = raceMatches.filter((row) => row.markets_added > 0).map((row) => row.race_id);
  if (matchedRaceIds.length > 0) {
    const { error: deactivateError } = await service
      .from("markets")
      .update({ is_active: false })
      .in("race_id", matchedRaceIds)
      .eq("provider", "the-odds-api");

    if (deactivateError) {
      return NextResponse.json({ error: deactivateError.message }, { status: 500 });
    }
  }

  if (oddsRows.length > 0) {
    const { error: oddsUpsertError } = await service.from("markets").upsert(oddsRows, {
      onConflict: "provider,provider_market_id,selection_key",
      ignoreDuplicates: false,
    });

    if (oddsUpsertError) {
      return NextResponse.json({ error: oddsUpsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    season,
    schedule_provider: scheduleProvider,
    schedule_upserted: scheduleUpserted,
    odds_ingested: true,
    odds_rows_upserted: oddsRows.length,
    races_considered_for_odds: candidateRaces.length,
    race_matches: raceMatches,
  });
}
