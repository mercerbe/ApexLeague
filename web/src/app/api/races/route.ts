import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const raceQuerySchema = z.object({
  status: z.enum(["scheduled", "locked", "settling", "settled"]).optional(),
  season: z.coerce.number().int().min(2026).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = raceQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    season: url.searchParams.get("season") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters", details: parsed.error.flatten() }, { status: 400 });
  }

  const { status, season, limit } = parsed.data;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("races")
    .select("id, season, round, slug, name, country, circuit, start_time, lock_time, status")
    .order("start_time", { ascending: true })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  if (season) {
    query = query.eq("season", season);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ races: data ?? [] });
}
