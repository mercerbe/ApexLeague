import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const leaderboardQuerySchema = z.object({
  season: z.coerce.number().int().min(2026).max(2100).default(new Date().getUTCFullYear()),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

interface MemberRow {
  user_id: string;
  season_points: number | string;
  league: {
    id: string;
    name: string;
    visibility: "public" | "private";
    season: number;
  } | null;
  profile: {
    handle: string | null;
    avatar_url: string | null;
  } | null;
}

function asNumber(value: number | string) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = leaderboardQuerySchema.safeParse({
    season: url.searchParams.get("season") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { season, limit } = parsed.data;
  const service = createSupabaseServiceRoleClient();

  const { data, error } = await service
    .from("league_members")
    .select(
      "user_id, season_points, league:leagues!inner(id, name, visibility, season), profile:profiles(handle, avatar_url)",
    )
    .eq("league.season", season)
    .returns<MemberRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userMap = new Map<
    string,
    {
      user_id: string;
      handle: string | null;
      avatar_url: string | null;
      leagues_count: number;
      total_points: number;
    }
  >();

  const leagueMap = new Map<
    string,
    {
      league_id: string;
      league_name: string;
      visibility: "public" | "private";
      member_count: number;
      total_points: number;
    }
  >();

  for (const row of data ?? []) {
    const points = asNumber(row.season_points);

    const userRecord = userMap.get(row.user_id);
    if (userRecord) {
      userRecord.total_points += points;
      userRecord.leagues_count += 1;
    } else {
      userMap.set(row.user_id, {
        user_id: row.user_id,
        handle: row.profile?.handle ?? null,
        avatar_url: row.profile?.avatar_url ?? null,
        leagues_count: 1,
        total_points: points,
      });
    }

    if (row.league) {
      const leagueRecord = leagueMap.get(row.league.id);
      if (leagueRecord) {
        leagueRecord.total_points += points;
        leagueRecord.member_count += 1;
      } else {
        leagueMap.set(row.league.id, {
          league_id: row.league.id,
          league_name: row.league.name,
          visibility: row.league.visibility,
          member_count: 1,
          total_points: points,
        });
      }
    }
  }

  const top_users = [...userMap.values()]
    .map((row) => ({
      ...row,
      total_points: Number(row.total_points.toFixed(2)),
    }))
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      ...row,
    }));

  const top_leagues = [...leagueMap.values()]
    .map((row) => {
      const average_points_per_user = row.member_count > 0 ? row.total_points / row.member_count : 0;
      return {
        ...row,
        total_points: Number(row.total_points.toFixed(2)),
        average_points_per_user: Number(average_points_per_user.toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (b.average_points_per_user === a.average_points_per_user) {
        return b.total_points - a.total_points;
      }
      return b.average_points_per_user - a.average_points_per_user;
    })
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      ...row,
    }));

  return NextResponse.json({
    season,
    top_users,
    top_leagues,
  });
}
