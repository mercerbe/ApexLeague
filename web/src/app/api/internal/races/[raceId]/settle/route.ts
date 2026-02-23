import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const paramsSchema = z.object({
  raceId: z.string().uuid(),
});

interface RaceRow {
  id: string;
  status: "scheduled" | "locked" | "settling" | "settled";
}

interface RaceResultRow {
  result_key: string;
  result_value: string;
  revision: number;
}

interface PendingBetRow {
  id: string;
  user_id: string;
  league_id: string;
  selection_key: string;
  stake: string | number;
  decimal_odds_snapshot: string | number;
}

interface PostgresError {
  code?: string;
  message: string;
}

function toNumber(value: string | number) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSelectionList(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const json = JSON.parse(trimmed);
      if (Array.isArray(json)) {
        return json.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // fall back to comma parsing
    }
  }

  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractRaceOutcome(resultRows: RaceResultRow[]) {
  const winningSelections = new Set<string>();
  const voidSelections = new Set<string>();

  for (const row of resultRows) {
    const key = row.result_key.trim().toLowerCase();
    const rawValue = row.result_value.trim();
    const value = rawValue.toLowerCase();

    if (key === "winning_selection_key") {
      winningSelections.add(rawValue);
      continue;
    }

    if (key === "winning_selection_keys") {
      parseSelectionList(rawValue).forEach((selection) => winningSelections.add(selection));
      continue;
    }

    if (key === "void_selection_key") {
      voidSelections.add(rawValue);
      continue;
    }

    if (key === "void_selection_keys") {
      parseSelectionList(rawValue).forEach((selection) => voidSelections.add(selection));
      continue;
    }

    if (key.startsWith("selection:")) {
      const selectionKey = row.result_key.slice("selection:".length);
      if (!selectionKey) {
        continue;
      }

      if (value === "won" || value === "win" || value === "true" || value === "1") {
        winningSelections.add(selectionKey);
      }

      if (value === "void") {
        voidSelections.add(selectionKey);
      }
    }
  }

  return { winningSelections, voidSelections };
}

function aggregateByLeagueUser(rows: Array<{ league_id: string; user_id: string; net_profit: number }>) {
  const totals = new Map<string, { league_id: string; user_id: string; net_profit: number }>();

  for (const row of rows) {
    const key = `${row.league_id}:${row.user_id}`;
    const current = totals.get(key);
    if (!current) {
      totals.set(key, { ...row });
      continue;
    }

    current.net_profit += row.net_profit;
  }

  return [...totals.values()];
}

function chooseLeagueWinners(rows: Array<{ league_id: string; user_id: string; net_profit: number }>) {
  const winners = new Map<string, { league_id: string; winner_user_id: string; race_points: number }>();

  for (const row of rows) {
    const current = winners.get(row.league_id);
    if (!current) {
      winners.set(row.league_id, {
        league_id: row.league_id,
        winner_user_id: row.user_id,
        race_points: row.net_profit,
      });
      continue;
    }

    if (row.net_profit > current.race_points) {
      winners.set(row.league_id, {
        league_id: row.league_id,
        winner_user_id: row.user_id,
        race_points: row.net_profit,
      });
      continue;
    }

    if (row.net_profit === current.race_points && row.user_id < current.winner_user_id) {
      winners.set(row.league_id, {
        league_id: row.league_id,
        winner_user_id: row.user_id,
        race_points: row.net_profit,
      });
    }
  }

  return [...winners.values()];
}

export async function POST(request: Request, context: { params: Promise<{ raceId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid race id." }, { status: 400 });
  }

  const env = getServerEnv();
  const configuredSecret = env.SETTLEMENT_CRON_SECRET;

  if (!configuredSecret) {
    return NextResponse.json({ error: "SETTLEMENT_CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-settlement-secret");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const suppliedSecret = bearerSecret ?? headerSecret;

  if (!suppliedSecret || suppliedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raceId } = parsedParams.data;
  const service = createSupabaseServiceRoleClient();

  const { data: race, error: raceError } = await service
    .from("races")
    .select("id, status")
    .eq("id", raceId)
    .single<RaceRow>();

  if (raceError || !race) {
    return NextResponse.json({ error: "Race not found." }, { status: 404 });
  }

  if (race.status === "settled") {
    return NextResponse.json({ race_id: raceId, status: "settled", settled_bets: 0, message: "Race already settled." });
  }

  const { error: statusToSettlingError } = await service
    .from("races")
    .update({ status: "settling" })
    .eq("id", raceId)
    .neq("status", "settled");

  if (statusToSettlingError) {
    return NextResponse.json({ error: statusToSettlingError.message }, { status: 500 });
  }

  const { data: resultRows, error: resultsError } = await service
    .from("race_results")
    .select("result_key, result_value, revision")
    .eq("race_id", raceId)
    .order("revision", { ascending: false })
    .returns<RaceResultRow[]>();

  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  if (!resultRows || resultRows.length === 0) {
    return NextResponse.json({ error: "No race results found. Cannot settle without outcomes." }, { status: 409 });
  }

  const latestRevision = Math.max(...resultRows.map((row) => row.revision));
  const latestResultRows = resultRows.filter((row) => row.revision === latestRevision);
  const { winningSelections, voidSelections } = extractRaceOutcome(latestResultRows);

  if (winningSelections.size === 0 && voidSelections.size === 0) {
    return NextResponse.json(
      {
        error: "No winning/void selections could be inferred from race_results.",
        hint: "Insert race_results rows using winning_selection_key(s), void_selection_key(s), or selection:<key> = won/void",
      },
      { status: 409 },
    );
  }

  const { data: pendingBets, error: pendingBetsError } = await service
    .from("bets")
    .select("id, user_id, league_id, selection_key, stake, decimal_odds_snapshot")
    .eq("race_id", raceId)
    .eq("status", "pending")
    .returns<PendingBetRow[]>();

  if (pendingBetsError) {
    return NextResponse.json({ error: pendingBetsError.message }, { status: 500 });
  }

  const settledRows: Array<{ league_id: string; user_id: string; net_profit: number }> = [];
  let settledBetsCount = 0;

  for (const bet of pendingBets ?? []) {
    const selectionKey = bet.selection_key;
    const stake = toNumber(bet.stake);
    const odds = toNumber(bet.decimal_odds_snapshot);

    let status: "won" | "lost" | "void" = "lost";
    let grossReturn = 0;
    let netProfit = -stake;

    if (voidSelections.has(selectionKey)) {
      status = "void";
      grossReturn = stake;
      netProfit = 0;
    } else if (winningSelections.has(selectionKey)) {
      status = "won";
      grossReturn = Number((stake * odds).toFixed(4));
      netProfit = Number((grossReturn - stake).toFixed(4));
    }

    const { error: updateError } = await service
      .from("bets")
      .update({
        status,
        gross_return: grossReturn,
        net_profit: netProfit,
        settled_at: new Date().toISOString(),
      })
      .eq("id", bet.id)
      .eq("status", "pending");

    if (updateError) {
      const typedError = updateError as PostgresError;
      return NextResponse.json({ error: `Failed to update bet ${bet.id}: ${typedError.message}` }, { status: 500 });
    }

    settledBetsCount += 1;
    settledRows.push({
      league_id: bet.league_id,
      user_id: bet.user_id,
      net_profit: netProfit,
    });
  }

  const leagueUserTotals = aggregateByLeagueUser(settledRows);

  for (const row of leagueUserTotals) {
    const { data: membership, error: membershipError } = await service
      .from("league_members")
      .select("season_points")
      .eq("league_id", row.league_id)
      .eq("user_id", row.user_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: `Failed to load league member ${row.user_id} in league ${row.league_id}.` },
        { status: 500 },
      );
    }

    const nextPoints = Number((toNumber(membership.season_points as string | number) + row.net_profit).toFixed(4));

    const { error: updatePointsError } = await service
      .from("league_members")
      .update({ season_points: nextPoints })
      .eq("league_id", row.league_id)
      .eq("user_id", row.user_id);

    if (updatePointsError) {
      return NextResponse.json({ error: updatePointsError.message }, { status: 500 });
    }
  }

  const winners = chooseLeagueWinners(leagueUserTotals);

  for (const winner of winners) {
    const { error: winnerUpsertError } = await service.from("race_league_winners").upsert(
      {
        race_id: raceId,
        league_id: winner.league_id,
        winner_user_id: winner.winner_user_id,
        race_points: Number(winner.race_points.toFixed(4)),
      },
      { onConflict: "race_id,league_id" },
    );

    if (winnerUpsertError) {
      return NextResponse.json({ error: winnerUpsertError.message }, { status: 500 });
    }
  }

  const { error: settleRaceError } = await service
    .from("races")
    .update({ status: "settled", result_revision: latestRevision })
    .eq("id", raceId);

  if (settleRaceError) {
    return NextResponse.json({ error: settleRaceError.message }, { status: 500 });
  }

  return NextResponse.json({
    race_id: raceId,
    status: "settled",
    settled_bets: settledBetsCount,
    winning_selection_keys: [...winningSelections],
    void_selection_keys: [...voidSelections],
    result_revision: latestRevision,
    league_winners_written: winners.length,
  });
}
