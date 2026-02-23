import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BetsClient } from "@/app/(authed)/races/[raceId]/bets/bets-client";

interface RaceBetsPageProps {
  params: Promise<{ raceId: string }>;
}

interface RaceRecord {
  id: string;
}

interface MembershipRecord {
  role: "owner" | "admin" | "member";
  league: {
    id: string;
    name: string;
  } | null;
}

export default async function RaceBetsPage({ params }: RaceBetsPageProps) {
  const { raceId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: race, error: raceError } = await supabase.from("races").select("id").eq("id", raceId).single<RaceRecord>();

  if (raceError || !race) {
    notFound();
  }

  const { data: memberships } = await supabase
    .from("league_members")
    .select("role, league:leagues(id, name)")
    .eq("user_id", user.id)
    .returns<MembershipRecord[]>();

  const leagueOptions = (memberships ?? [])
    .filter((membership) => membership.league)
    .map((membership) => ({
      id: membership.league!.id,
      name: membership.league!.name,
      role: membership.role,
    }));

  if (leagueOptions.length === 0) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center gap-4 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Join a League First</h1>
        <p className="text-neutral-600">You need league membership before placing race bets.</p>
        <Link href="/leagues" className="w-fit rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700">
          Browse Leagues
        </Link>
      </main>
    );
  }

  return <BetsClient raceId={raceId} leagues={leagueOptions} />;
}
