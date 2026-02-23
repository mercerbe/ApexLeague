import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { JoinLeagueButton } from "@/app/(authed)/league/[id]/join-league-button";
import { InviteForm } from "@/app/(authed)/league/[id]/invite-form";
import { InviteHistory } from "@/app/(authed)/league/[id]/invite-history";
import { LeagueFeed } from "@/app/(authed)/league/[id]/league-feed";
import { LeagueStandings } from "@/app/(authed)/league/[id]/league-standings";

interface LeaguePageProps {
  params: Promise<{ id: string }>;
}

interface LeagueRecord {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  season: number;
  owner_id: string;
  created_at: string;
}

interface LeagueMemberRecord {
  user_id: string;
  role: "owner" | "admin" | "member";
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name, description, visibility, season, owner_id, created_at")
    .eq("id", id)
    .single<LeagueRecord>();

  if (leagueError || !league) {
    notFound();
  }

  const { data: members } = await supabase
    .from("league_members")
    .select("user_id, role")
    .eq("league_id", id)
    .returns<LeagueMemberRecord[]>();

  const userMembership = members?.find((member) => member.user_id === user?.id) ?? null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">League Detail</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{league.name}</h1>
          <p className="mt-2 text-neutral-600">
            {league.description ?? "No description yet."} Season {league.season}. Visibility: {league.visibility}.
          </p>
        </div>
        <Link href="/leagues" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700">
          Back to Leagues
        </Link>
      </div>

      {userMembership ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          You are a {userMembership.role} in this league.
        </p>
      ) : (
        <JoinLeagueButton leagueId={id} />
      )}

      {userMembership && (userMembership.role === "owner" || userMembership.role === "admin") ? (
        <>
          <InviteForm leagueId={id} />
          <InviteHistory leagueId={id} />
        </>
      ) : null}

      <LeagueFeed leagueId={id} isMember={Boolean(userMembership)} />
      <LeagueStandings leagueId={id} isMember={Boolean(userMembership)} />
    </main>
  );
}
