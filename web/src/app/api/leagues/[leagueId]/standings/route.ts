import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const leagueIdParamsSchema = z.object({
  leagueId: z.string().uuid(),
});

interface StandingRecord {
  user_id: string;
  role: "owner" | "admin" | "member";
  season_points: string | number;
  joined_at: string;
  profile: {
    handle: string | null;
    avatar_url: string | null;
  } | null;
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

  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  const { leagueId } = parsedParams.data;

  const { data, error } = await auth.supabase
    .from("league_members")
    .select("user_id, role, season_points, joined_at, profile:profiles(handle, avatar_url)")
    .eq("league_id", leagueId)
    .order("season_points", { ascending: false })
    .order("joined_at", { ascending: true })
    .returns<StandingRecord[]>();

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "You are not a member of this league." }, { status: 403 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const standings = (data ?? []).reduce<
    Array<{
      user_id: string;
      role: "owner" | "admin" | "member";
      season_points: number;
      handle: string | null;
      avatar_url: string | null;
      rank: number;
      points_from_leader: number;
    }>
  >((acc, entry, index, rows) => {
    const points = Number(entry.season_points);
    const leaderPoints = Number(rows[0]?.season_points ?? 0);
    const previous = acc[index - 1];
    const previousPoints = Number(rows[index - 1]?.season_points ?? 0);
    const rank = previous && previousPoints === points ? previous.rank : index + 1;

    acc.push({
      user_id: entry.user_id,
      role: entry.role,
      season_points: points,
      handle: entry.profile?.handle ?? null,
      avatar_url: entry.profile?.avatar_url ?? null,
      rank,
      points_from_leader: Number((leaderPoints - points).toFixed(2)),
    });

    return acc;
  }, []);

  return NextResponse.json({ standings });
}
