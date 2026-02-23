import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const leagueIdParamsSchema = z.object({
  leagueId: z.string().uuid(),
});

interface WinnerRow {
  race_id: string;
  winner_user_id: string;
  race_points: number | string;
}

interface RaceRow {
  id: string;
  name: string;
  round: number;
  season: number;
  start_time: string;
}

interface ProfileRow {
  id: string;
  handle: string | null;
  avatar_url: string | null;
}

function asNumber(value: number | string) {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireAuthedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null as null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user, error: null as NextResponse<unknown> | null };
}

export async function GET(_request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const parsedParams = leagueIdParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  const { leagueId } = parsedParams.data;
  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  const { data: membership } = await auth.supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", auth.user?.id ?? "")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this league." }, { status: 403 });
  }

  const { data: winners, error: winnersError } = await auth.supabase
    .from("race_league_winners")
    .select("race_id, winner_user_id, race_points")
    .eq("league_id", leagueId)
    .returns<WinnerRow[]>();

  if (winnersError) {
    return NextResponse.json({ error: winnersError.message }, { status: 500 });
  }

  const raceIds = [...new Set((winners ?? []).map((winner) => winner.race_id))];
  const userIds = [...new Set((winners ?? []).map((winner) => winner.winner_user_id))];

  const [racesRes, profilesRes] = await Promise.all([
    raceIds.length
      ? auth.supabase.from("races").select("id, name, round, season, start_time").in("id", raceIds).returns<RaceRow[]>()
      : Promise.resolve({ data: [] as RaceRow[], error: null }),
    userIds.length
      ? auth.supabase.from("profiles").select("id, handle, avatar_url").in("id", userIds).returns<ProfileRow[]>()
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
  ]);

  if (racesRes.error) {
    return NextResponse.json({ error: racesRes.error.message }, { status: 500 });
  }
  if (profilesRes.error) {
    return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });
  }

  const raceMap = new Map((racesRes.data ?? []).map((race) => [race.id, race]));
  const profileMap = new Map((profilesRes.data ?? []).map((profile) => [profile.id, profile]));

  const trophies = (winners ?? [])
    .map((winner) => {
      const race = raceMap.get(winner.race_id);
      const winnerProfile = profileMap.get(winner.winner_user_id);
      if (!race) {
        return null;
      }

      return {
        race_id: winner.race_id,
        race_name: race.name,
        round: race.round,
        season: race.season,
        race_start_time: race.start_time,
        winner_user_id: winner.winner_user_id,
        winner_handle: winnerProfile?.handle ?? null,
        winner_avatar_url: winnerProfile?.avatar_url ?? null,
        race_points: Number(asNumber(winner.race_points).toFixed(2)),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => new Date(a.race_start_time).getTime() - new Date(b.race_start_time).getTime());

  return NextResponse.json({ trophies });
}
