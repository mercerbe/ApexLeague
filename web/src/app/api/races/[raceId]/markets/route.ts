import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  raceId: z.string().uuid(),
});

const querySchema = z.object({
  include_inactive: z.coerce.boolean().default(false),
});

export async function GET(request: Request, context: { params: Promise<{ raceId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid race id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    include_inactive: url.searchParams.get("include_inactive") ?? "false",
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters", details: parsedQuery.error.flatten() }, { status: 400 });
  }

  const { raceId } = parsedParams.data;
  const { include_inactive } = parsedQuery.data;
  const supabase = await createSupabaseServerClient();

  const { data: race, error: raceError } = await supabase
    .from("races")
    .select(
      "id, season, round, slug, name, country, circuit, venue_name, city, timezone, race_description, image_url, banner_url, poster_url, highlights_url, start_time, lock_time, status",
    )
    .eq("id", raceId)
    .single();

  if (raceError || !race) {
    return NextResponse.json({ error: "Race not found." }, { status: 404 });
  }

  let marketsQuery = supabase
    .from("markets")
    .select("id, race_id, provider, provider_market_id, market_type, selection_key, selection_label, decimal_odds, american_odds, is_active, fetched_at")
    .eq("race_id", raceId)
    .order("market_type", { ascending: true })
    .order("selection_label", { ascending: true });

  if (!include_inactive) {
    marketsQuery = marketsQuery.eq("is_active", true);
  }

  const { data: markets, error: marketsError } = await marketsQuery;

  if (marketsError) {
    return NextResponse.json({ error: marketsError.message }, { status: 500 });
  }

  return NextResponse.json({ race, markets: markets ?? [] });
}
