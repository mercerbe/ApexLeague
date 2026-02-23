import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { isAuthorizedInternalRequest } from "@/lib/internal/auth";
import {
  buildDriverAliasMap,
  findBestRaceSessionForRace,
  findFastestLapDriverNumber,
  getSessionDrivers,
  getSessionLaps,
  getSessionResults,
  isSessionFinalized,
  marketSelectionToDriverNumber,
} from "@/lib/results/openf1";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const paramsSchema = z.object({
  raceId: z.string().uuid(),
});

interface RaceRow {
  id: string;
  season: number;
  name: string;
  country: string | null;
  start_time: string;
  result_revision: number;
}

interface MarketRow {
  id: string;
  selection_key: string;
  market_type: string;
  is_active: boolean;
}

interface SessionResultRow {
  driver_number: number;
  position: number | null;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
}

function evaluateSelectionOutcome(args: {
  selectionKey: string;
  marketType: string;
  driverNumber: number | null;
  resultsByDriver: Map<number, SessionResultRow>;
  fastestLapDriver: number | null;
}) {
  const { selectionKey, marketType, driverNumber, resultsByDriver, fastestLapDriver } = args;

  const normalizedType = marketType.toLowerCase();
  const normalizedKey = selectionKey.toLowerCase();

  const isWinnerMarket = normalizedType === "race_winner" || normalizedKey.endsWith("_win");
  const isPodiumMarket = normalizedType === "podium_finish" || normalizedKey.endsWith("_podium");
  const isTop6Market = normalizedType === "top_6_finish" || normalizedKey.endsWith("_top6") || normalizedKey.endsWith("_top_6");
  const isTop10Market = normalizedType === "top_10_finish" || normalizedKey.endsWith("_top10") || normalizedKey.endsWith("_top_10");
  const isFastestLapMarket = normalizedType === "fastest_lap" || normalizedKey.endsWith("_fastest_lap");

  if (driverNumber == null) {
    return "void" as const;
  }

  const result = resultsByDriver.get(driverNumber);

  if (!result) {
    return "void" as const;
  }

  if (result.dns || result.dsq) {
    return "lost" as const;
  }

  if (result.position == null) {
    return "void" as const;
  }

  if (isWinnerMarket) {
    return result.position === 1 ? ("won" as const) : ("lost" as const);
  }

  if (isPodiumMarket) {
    return result.position <= 3 ? ("won" as const) : ("lost" as const);
  }

  if (isTop6Market) {
    return result.position <= 6 ? ("won" as const) : ("lost" as const);
  }

  if (isTop10Market) {
    return result.position <= 10 ? ("won" as const) : ("lost" as const);
  }

  if (isFastestLapMarket) {
    if (fastestLapDriver == null) {
      return "void" as const;
    }

    return fastestLapDriver === driverNumber ? ("won" as const) : ("lost" as const);
  }

  return "void" as const;
}

export async function POST(request: Request, context: { params: Promise<{ raceId: string }> }) {
  const auth = isAuthorizedInternalRequest(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "Unauthorized" ? 401 : 500 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid race id." }, { status: 400 });
  }

  const env = getServerEnv();
  const provider = (env.F1_RESULTS_PROVIDER ?? "openf1").toLowerCase();

  if (provider !== "openf1") {
    return NextResponse.json({ error: `Unsupported F1_RESULTS_PROVIDER: ${provider}` }, { status: 400 });
  }

  const { raceId } = parsedParams.data;
  const service = createSupabaseServiceRoleClient();

  const { data: race, error: raceError } = await service
    .from("races")
    .select("id, season, name, country, start_time, result_revision")
    .eq("id", raceId)
    .single<RaceRow>();

  if (raceError || !race) {
    return NextResponse.json({ error: "Race not found." }, { status: 404 });
  }

  const session = await findBestRaceSessionForRace({
    season: race.season,
    country: race.country,
    name: race.name,
    start_time: race.start_time,
  });

  if (!session) {
    return NextResponse.json({ error: "No matching OpenF1 session found for this race." }, { status: 404 });
  }

  if (!isSessionFinalized(session)) {
    return NextResponse.json(
      {
        race_id: raceId,
        ingested: false,
        finalized: false,
        message: "OpenF1 race session is not finalized yet.",
        session_key: session.session_key,
      },
      { status: 202 },
    );
  }

  const [sessionResults, drivers, laps, markets] = await Promise.all([
    getSessionResults(session.session_key),
    getSessionDrivers(session.session_key),
    getSessionLaps(session.session_key).catch(() => []),
    service
      .from("markets")
      .select("id, selection_key, market_type, is_active")
      .eq("race_id", raceId)
      .returns<MarketRow[]>()
      .then((result) => {
        if (result.error) {
          throw new Error(result.error.message);
        }

        return result.data ?? [];
      }),
  ]);

  if (sessionResults.length === 0) {
    return NextResponse.json(
      {
        race_id: raceId,
        ingested: false,
        finalized: false,
        message: "OpenF1 has no session_result rows yet.",
        session_key: session.session_key,
      },
      { status: 202 },
    );
  }

  const resultsByDriver = new Map<number, SessionResultRow>(
    sessionResults.map((row) => [row.driver_number, row as SessionResultRow]),
  );

  const aliasMap = buildDriverAliasMap(drivers);
  const fastestLapDriver = findFastestLapDriverNumber(laps);

  const nextRevision = (race.result_revision ?? 0) + 1;

  const rows = markets.map((market) => {
    const driverNumber = marketSelectionToDriverNumber(market.selection_key, aliasMap);
    const outcome = evaluateSelectionOutcome({
      selectionKey: market.selection_key,
      marketType: market.market_type,
      driverNumber,
      resultsByDriver,
      fastestLapDriver,
    });

    return {
      race_id: raceId,
      result_key: `selection:${market.selection_key}`,
      result_value: outcome,
      source: `openf1:session_result:${session.session_key}`,
      revision: nextRevision,
    };
  });

  const { error: insertError } = await service.from("race_results").insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: updateRevisionError } = await service.from("races").update({ result_revision: nextRevision }).eq("id", raceId);

  if (updateRevisionError) {
    return NextResponse.json({ error: updateRevisionError.message }, { status: 500 });
  }

  return NextResponse.json({
    race_id: raceId,
    ingested: true,
    finalized: true,
    session_key: session.session_key,
    revision: nextRevision,
    inserted_rows: rows.length,
  });
}
