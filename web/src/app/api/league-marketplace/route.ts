import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const marketplaceQuerySchema = z.object({
  season: z.coerce.number().int().min(2026).max(2100).default(2026),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

interface MemberRecord {
  user_id: string;
  season_points: number | string;
  role: "owner" | "admin" | "member";
  profile: {
    handle: string | null;
    avatar_url: string | null;
  } | null;
}

interface LeagueRecord {
  id: string;
  name: string;
  description: string | null;
  season: number;
  visibility: "public" | "private";
  created_at: string;
  members: MemberRecord[] | null;
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
  const parsedQuery = marketplaceQuerySchema.safeParse({
    season: url.searchParams.get("season") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters.", details: parsedQuery.error.flatten() }, { status: 400 });
  }

  const { season, limit } = parsedQuery.data;
  const service = createSupabaseServiceRoleClient();

  const { data, error } = await service
    .from("leagues")
    .select(
      "id, name, description, season, visibility, created_at, members:league_members(user_id, season_points, role, profile:profiles(handle, avatar_url))",
    )
    .eq("visibility", "public")
    .eq("season", season)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<LeagueRecord[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const leagues = (data ?? []).map((league) => {
    const members = league.members ?? [];
    const sortedMembers = [...members].sort((a, b) => asNumber(b.season_points) - asNumber(a.season_points));
    const totalPoints = sortedMembers.reduce((acc, member) => acc + asNumber(member.season_points), 0);

    return {
      id: league.id,
      name: league.name,
      description: league.description,
      season: league.season,
      member_count: sortedMembers.length,
      total_points: Number(totalPoints.toFixed(2)),
      top_members: sortedMembers.slice(0, 3).map((member, index) => ({
        rank: index + 1,
        user_id: member.user_id,
        role: member.role,
        season_points: Number(asNumber(member.season_points).toFixed(2)),
        handle: member.profile?.handle ?? null,
        avatar_url: member.profile?.avatar_url ?? null,
      })),
    };
  });

  return NextResponse.json({ leagues });
}
