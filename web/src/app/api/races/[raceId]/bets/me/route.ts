import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  raceId: z.string().uuid(),
});

const querySchema = z.object({
  league_id: z.string().uuid(),
});

function asNumber(value: string | number) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request, context: { params: Promise<{ raceId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid race id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    league_id: url.searchParams.get("league_id"),
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "league_id query parameter is required." }, { status: 400 });
  }

  const { raceId } = parsedParams.data;
  const { league_id: leagueId } = parsedQuery.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this league." }, { status: 403 });
  }

  const { data: bets, error } = await supabase
    .from("bets")
    .select(
      "id, league_id, race_id, market_id, selection_key, stake, decimal_odds_snapshot, status, gross_return, net_profit, placed_at, created_at, market:markets(selection_label, market_type)",
    )
    .eq("user_id", user.id)
    .eq("league_id", leagueId)
    .eq("race_id", raceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalizedBets = (bets ?? []).map((bet) => ({
    ...bet,
    stake: asNumber(bet.stake as string | number),
    decimal_odds_snapshot: asNumber(bet.decimal_odds_snapshot as string | number),
    gross_return: bet.gross_return == null ? null : asNumber(bet.gross_return as string | number),
    net_profit: bet.net_profit == null ? null : asNumber(bet.net_profit as string | number),
  }));

  const pendingStake = normalizedBets
    .filter((bet) => bet.status === "pending")
    .reduce((acc, bet) => acc + bet.stake, 0);

  return NextResponse.json({
    league_id: leagueId,
    race_id: raceId,
    bankroll: 100,
    pending_stake: Number(pendingStake.toFixed(2)),
    remaining_tokens: Number((100 - pendingStake).toFixed(2)),
    bets: normalizedBets,
  });
}
