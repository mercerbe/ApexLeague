import { NextResponse } from "next/server";
import { getInternalAuthSecret, isAuthorizedInternalRequest } from "@/lib/internal/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

interface RaceCandidate {
  id: string;
  status: "locked" | "settling";
  start_time: string;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const runStartedAt = new Date();
  const runStartMs = Date.now();
  const auth = isAuthorizedInternalRequest(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "Unauthorized" ? 401 : 500 });
  }

  const secret = getInternalAuthSecret();

  if (!secret) {
    return NextResponse.json({ error: "Internal secret is not configured." }, { status: 500 });
  }

  const service = createSupabaseServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: candidates, error } = await service
    .from("races")
    .select("id, status, start_time")
    .in("status", ["locked", "settling"])
    .lte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(20)
    .returns<RaceCandidate[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const summary: Array<{
    race_id: string;
    status_before: "locked" | "settling";
    started_at: string;
    finished_at?: string;
    duration_ms?: number;
    ingest_status: number;
    ingest_duration_ms?: number;
    settle_status?: number;
    settle_duration_ms?: number;
    finalized?: boolean;
    settled?: boolean;
    error?: string;
  }> = [];

  for (const race of candidates ?? []) {
    const raceStartMs = Date.now();
    const raceStartedAt = new Date(raceStartMs).toISOString();
    const ingestStartMs = Date.now();
    const ingestResponse = await fetch(`${origin}/api/internal/races/${race.id}/ingest-results`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });
    const ingestDurationMs = Date.now() - ingestStartMs;

    const ingestPayload = await safeJson(ingestResponse);

    if (ingestResponse.status === 202) {
      summary.push({
        race_id: race.id,
        status_before: race.status,
        started_at: raceStartedAt,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - raceStartMs,
        ingest_status: ingestResponse.status,
        ingest_duration_ms: ingestDurationMs,
        finalized: false,
      });
      continue;
    }

    if (!ingestResponse.ok) {
      summary.push({
        race_id: race.id,
        status_before: race.status,
        started_at: raceStartedAt,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - raceStartMs,
        ingest_status: ingestResponse.status,
        ingest_duration_ms: ingestDurationMs,
        error: ingestPayload?.error ?? "ingest failed",
      });
      continue;
    }

    const settleStartMs = Date.now();
    const settleResponse = await fetch(`${origin}/api/internal/races/${race.id}/settle`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });
    const settleDurationMs = Date.now() - settleStartMs;

    const settlePayload = await safeJson(settleResponse);

    if (!settleResponse.ok) {
      summary.push({
        race_id: race.id,
        status_before: race.status,
        started_at: raceStartedAt,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - raceStartMs,
        ingest_status: ingestResponse.status,
        ingest_duration_ms: ingestDurationMs,
        settle_status: settleResponse.status,
        settle_duration_ms: settleDurationMs,
        finalized: true,
        error: settlePayload?.error ?? "settle failed",
      });
      continue;
    }

    summary.push({
      race_id: race.id,
      status_before: race.status,
      started_at: raceStartedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - raceStartMs,
      ingest_status: ingestResponse.status,
      ingest_duration_ms: ingestDurationMs,
      settle_status: settleResponse.status,
      settle_duration_ms: settleDurationMs,
      finalized: true,
      settled: true,
    });
  }

  const responsePayload = {
    run_started_at: runStartedAt.toISOString(),
    run_finished_at: new Date().toISOString(),
    duration_ms: Date.now() - runStartMs,
    ran_at: nowIso,
    candidate_count: candidates?.length ?? 0,
    settled_count: summary.filter((row) => row.settled).length,
    pending_finalization_count: summary.filter((row) => row.finalized === false).length,
    failures: summary.filter((row) => row.error).length,
    summary,
  };

  console.info("[settle-races-cron]", JSON.stringify(responsePayload));

  return NextResponse.json(responsePayload);
}
