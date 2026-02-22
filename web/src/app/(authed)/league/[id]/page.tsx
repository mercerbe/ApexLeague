import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { JoinLeagueButton } from "@/app/(authed)/league/[id]/join-league-button";

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
  season_points: number;
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
    .select("user_id, role, season_points")
    .eq("league_id", id)
    .order("season_points", { ascending: false })
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

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Standings (Current)</h2>
        {members && members.length > 0 ? (
          <ol className="mt-4 space-y-2">
            {members.map((member, index) => (
              <li key={member.user_id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-neutral-800">{member.user_id.slice(0, 8)}</span>
                  <span className="text-xs uppercase tracking-wide text-neutral-500">{member.role}</span>
                </div>
                <span className="text-sm font-semibold text-neutral-900">{member.season_points.toFixed(2)} pts</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-neutral-600">No members yet.</p>
        )}
      </section>
    </main>
  );
}
