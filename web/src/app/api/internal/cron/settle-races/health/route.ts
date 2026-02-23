import { NextResponse } from "next/server";
import { isAuthorizedInternalRequest } from "@/lib/internal/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

interface SettledRaceSummary {
  id: string;
  name: string;
  start_time: string;
  updated_at: string;
  result_revision: number;
}

export async function GET(request: Request) {
  const auth = isAuthorizedInternalRequest(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "Unauthorized" ? 401 : 500 });
  }

  const service = createSupabaseServiceRoleClient();
  const nowIso = new Date().toISOString();

  const [scheduledCountRes, lockedCountRes, settlingCountRes, settledCountRes, overdueRacesRes, latestSettledRaceRes] = await Promise.all([
    service.from("races").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
    service.from("races").select("*", { count: "exact", head: true }).eq("status", "locked"),
    service.from("races").select("*", { count: "exact", head: true }).eq("status", "settling"),
    service.from("races").select("*", { count: "exact", head: true }).eq("status", "settled"),
    service
      .from("races")
      .select("id, status, start_time")
      .in("status", ["locked", "settling"])
      .lte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(200),
    service
      .from("races")
      .select("id, name, start_time, updated_at, result_revision")
      .eq("status", "settled")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<SettledRaceSummary>(),
  ]);

  const errors = [
    scheduledCountRes.error,
    lockedCountRes.error,
    settlingCountRes.error,
    settledCountRes.error,
    overdueRacesRes.error,
    latestSettledRaceRes.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.map((item) => item?.message).join(" | ") }, { status: 500 });
  }

  const overdueRaceIds = (overdueRacesRes.data ?? []).map((race) => race.id);
  let pendingBetsInOverdueRaces = 0;

  if (overdueRaceIds.length > 0) {
    const { count, error } = await service.from("bets").select("*", { count: "exact", head: true }).in("race_id", overdueRaceIds).eq("status", "pending");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    pendingBetsInOverdueRaces = count ?? 0;
  }

  return NextResponse.json({
    observed_at: nowIso,
    race_status_counts: {
      scheduled: scheduledCountRes.count ?? 0,
      locked: lockedCountRes.count ?? 0,
      settling: settlingCountRes.count ?? 0,
      settled: settledCountRes.count ?? 0,
    },
    overdue_race_count: overdueRaceIds.length,
    overdue_race_ids: overdueRaceIds,
    pending_bets_in_overdue_races: pendingBetsInOverdueRaces,
    latest_settled_race: latestSettledRaceRes.data ?? null,
  });
}
