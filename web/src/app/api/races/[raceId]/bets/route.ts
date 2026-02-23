import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/profile/ensure-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  raceId: z.string().uuid(),
});

const placeBetsSchema = z.object({
  league_id: z.string().uuid(),
  bets: z
    .array(
      z.object({
        market_id: z.string().uuid(),
        stake: z.number().positive().max(100),
      }),
    )
    .min(1)
    .max(20),
});

interface PostgresError {
  code?: string;
  message: string;
}

function asNumber(value: string | number) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function POST(request: Request, context: { params: Promise<{ raceId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid race id." }, { status: 400 });
  }

  let payload: z.infer<typeof placeBetsSchema>;

  try {
    const json = await request.json();
    payload = placeBetsSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { raceId } = parsedParams.data;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserProfile(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile bootstrap failed" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const { data: race, error: raceError } = await supabase
    .from("races")
    .select("id, status, lock_time")
    .eq("id", raceId)
    .single<{ id: string; status: string; lock_time: string }>();

  if (raceError || !race) {
    return NextResponse.json({ error: "Race not found." }, { status: 404 });
  }

  if (race.status !== "scheduled") {
    return NextResponse.json({ error: "RACE_LOCKED" }, { status: 409 });
  }

  if (race.lock_time <= nowIso) {
    return NextResponse.json({ error: "RACE_LOCKED" }, { status: 409 });
  }

  const { data: membership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", payload.league_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this league." }, { status: 403 });
  }

  const marketIds = [...new Set(payload.bets.map((bet) => bet.market_id))];

  if (marketIds.length !== payload.bets.length) {
    return NextResponse.json({ error: "Duplicate market selections are not allowed." }, { status: 400 });
  }

  const { data: markets, error: marketsError } = await supabase
    .from("markets")
    .select("id, race_id, selection_key, decimal_odds, is_active")
    .eq("race_id", raceId)
    .in("id", marketIds);

  if (marketsError) {
    return NextResponse.json({ error: marketsError.message }, { status: 500 });
  }

  const marketMap = new Map((markets ?? []).map((market) => [market.id, market]));

  for (const bet of payload.bets) {
    const market = marketMap.get(bet.market_id);

    if (!market || !market.is_active) {
      return NextResponse.json({ error: "MARKET_NOT_FOUND", market_id: bet.market_id }, { status: 400 });
    }
  }

  const stakeToPlace = payload.bets.reduce((acc, bet) => acc + bet.stake, 0);

  const { data: existingBets, error: existingBetsError } = await supabase
    .from("bets")
    .select("stake")
    .eq("user_id", user.id)
    .eq("league_id", payload.league_id)
    .eq("race_id", raceId)
    .eq("status", "pending");

  if (existingBetsError) {
    return NextResponse.json({ error: existingBetsError.message }, { status: 500 });
  }

  const existingStake = (existingBets ?? []).reduce((acc, row) => acc + asNumber(row.stake), 0);

  if (Number.isNaN(existingStake)) {
    return NextResponse.json({ error: "Unable to calculate current stake total." }, { status: 500 });
  }

  if (existingStake + stakeToPlace > 100) {
    return NextResponse.json(
      {
        error: "STAKE_LIMIT_EXCEEDED",
        existing_stake: existingStake,
        requested_stake: stakeToPlace,
        max_stake: 100,
      },
      { status: 409 },
    );
  }

  const rowsToInsert = payload.bets.map((bet) => {
    const market = marketMap.get(bet.market_id)!;

    return {
      user_id: user.id,
      league_id: payload.league_id,
      race_id: raceId,
      market_id: market.id,
      selection_key: market.selection_key,
      stake: Number(bet.stake.toFixed(2)),
      decimal_odds_snapshot: asNumber(market.decimal_odds),
      status: "pending" as const,
    };
  });

  const { data: acceptedBets, error: insertError } = await supabase
    .from("bets")
    .insert(rowsToInsert)
    .select("id, market_id, selection_key, stake, decimal_odds_snapshot, status, created_at")
    .returns<
      {
        id: string;
        market_id: string;
        selection_key: string;
        stake: string | number;
        decimal_odds_snapshot: string | number;
        status: "pending" | "won" | "lost" | "void";
        created_at: string;
      }[]
    >();

  if (insertError) {
    const typedError = insertError as PostgresError;

    if (typedError.code === "42501") {
      return NextResponse.json({ error: "You do not have permission to place these bets." }, { status: 403 });
    }

    return NextResponse.json({ error: typedError.message }, { status: 500 });
  }

  const remainingPoints = Number((100 - (existingStake + stakeToPlace)).toFixed(2));

  return NextResponse.json(
    {
      race_id: raceId,
      league_id: payload.league_id,
      accepted_bets: (acceptedBets ?? []).map((bet) => ({
        bet_id: bet.id,
        market_id: bet.market_id,
        selection_key: bet.selection_key,
        stake: asNumber(bet.stake),
        decimal_odds_snapshot: asNumber(bet.decimal_odds_snapshot),
        status: bet.status,
      })),
      remaining_points: remainingPoints,
    },
    { status: 201 },
  );
}
