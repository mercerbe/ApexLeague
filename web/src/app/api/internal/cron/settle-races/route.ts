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
    ingest_status: number;
    settle_status?: number;
    finalized?: boolean;
    settled?: boolean;
    error?: string;
  }> = [];

  for (const race of candidates ?? []) {
    const ingestResponse = await fetch(`${origin}/api/internal/races/${race.id}/ingest-results`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    const ingestPayload = await safeJson(ingestResponse);

    if (ingestResponse.status === 202) {
      summary.push({
        race_id: race.id,
        ingest_status: ingestResponse.status,
        finalized: false,
      });
      continue;
    }

    if (!ingestResponse.ok) {
      summary.push({
        race_id: race.id,
        ingest_status: ingestResponse.status,
        error: ingestPayload?.error ?? "ingest failed",
      });
      continue;
    }

    const settleResponse = await fetch(`${origin}/api/internal/races/${race.id}/settle`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    const settlePayload = await safeJson(settleResponse);

    if (!settleResponse.ok) {
      summary.push({
        race_id: race.id,
        ingest_status: ingestResponse.status,
        settle_status: settleResponse.status,
        finalized: true,
        error: settlePayload?.error ?? "settle failed",
      });
      continue;
    }

    summary.push({
      race_id: race.id,
      ingest_status: ingestResponse.status,
      settle_status: settleResponse.status,
      finalized: true,
      settled: true,
    });
  }

  return NextResponse.json({
    ran_at: nowIso,
    candidate_count: candidates?.length ?? 0,
    settled_count: summary.filter((row) => row.settled).length,
    pending_finalization_count: summary.filter((row) => row.finalized === false).length,
    failures: summary.filter((row) => row.error).length,
    summary,
  });
}
