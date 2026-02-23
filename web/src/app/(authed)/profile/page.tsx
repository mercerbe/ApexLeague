import Link from "next/link";
import { ProfileForm } from "@/app/(authed)/profile/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface LeagueInfo {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  season: number;
}

interface MembershipRow {
  league_id: string;
  role: "owner" | "admin" | "member";
  season_points: number | string;
  joined_at: string;
  league: LeagueInfo | LeagueInfo[] | null;
}

interface RaceInfo {
  id: string;
  name: string;
  season: number;
  round: number;
}

interface MarketInfo {
  id: string;
  selection_label: string;
  market_type: string;
}

interface LeagueNameInfo {
  id: string;
  name: string;
}

interface BetRow {
  id: string;
  stake: number | string;
  status: "pending" | "won" | "lost" | "void";
  gross_return: number | string | null;
  net_profit: number | string | null;
  placed_at: string;
  league: LeagueNameInfo | LeagueNameInfo[] | null;
  race: RaceInfo | RaceInfo[] | null;
  market: MarketInfo | MarketInfo[] | null;
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asSingle<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [membershipsRes, betsRes] = await Promise.all([
    supabase
      .from("league_members")
      .select("league_id, role, season_points, joined_at, league:leagues(id, name, description, visibility, season)")
      .eq("user_id", user?.id ?? "")
      .order("season_points", { ascending: false })
      .returns<MembershipRow[]>(),
    supabase
      .from("bets")
      .select(
        "id, stake, status, gross_return, net_profit, placed_at, league:leagues(id, name), race:races(id, name, season, round), market:markets(id, selection_label, market_type)",
      )
      .eq("user_id", user?.id ?? "")
      .order("placed_at", { ascending: false })
      .limit(20)
      .returns<BetRow[]>(),
  ]);

  const memberships =
    membershipsRes.data?.map((row) => ({
      ...row,
      league: asSingle(row.league),
      season_points: asNumber(row.season_points),
    })) ?? [];

  const bets =
    betsRes.data?.map((row) => ({
      ...row,
      stake: asNumber(row.stake),
      gross_return: asNumber(row.gross_return),
      net_profit: asNumber(row.net_profit),
      league: asSingle(row.league),
      race: asSingle(row.race),
      market: asSingle(row.market),
    })) ?? [];

  const totalLeaguePoints = memberships.reduce((acc, row) => acc + asNumber(row.season_points), 0);
  const bestLeague = memberships[0];
  const pendingBets = bets.filter((bet) => bet.status === "pending").length;
  const totalStaked = bets.reduce((acc, bet) => acc + asNumber(bet.stake), 0);
  const totalNet = bets.reduce((acc, bet) => acc + asNumber(bet.net_profit), 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,#ffeab6_0%,transparent_38%),radial-gradient(circle_at_85%_10%,#ffd1a8_0%,transparent_36%),linear-gradient(170deg,#f7f6f3_0%,#ebe9e2_45%,#dfddd5_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="rounded-3xl border border-neutral-300/70 bg-white/70 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">Your Driver Dashboard</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">Profile</h1>
          <p className="mt-2 max-w-3xl text-neutral-700">
            Manage your identity and monitor how your picks are performing across leagues this season.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Leagues Joined</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">{memberships.length}</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Total League Points</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">{totalLeaguePoints.toFixed(2)}</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Open Bets</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">{pendingBets}</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Net Profit (Last 20)</p>
              <p className={`mt-1 text-lg font-bold ${totalNet >= 0 ? "text-emerald-700" : "text-red-700"}`}>{totalNet.toFixed(2)}</p>
            </article>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">League Memberships</h2>
                <p className="mt-1 text-sm text-neutral-700">Your points and roles across joined leagues.</p>
              </div>
              <Link href="/leagues" className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
                Manage Leagues
              </Link>
            </div>

            {memberships.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-600">You are not in any leagues yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {memberships.map((membership) => (
                  <li key={`${membership.league_id}-${membership.joined_at}`} className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">{membership.league?.name ?? "Unknown league"}</p>
                        <p className="mt-0.5 text-xs text-neutral-600">
                          Season {membership.league?.season ?? "n/a"} • {membership.league?.visibility ?? "private"} • {membership.role}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">{asNumber(membership.season_points).toFixed(2)}</p>
                    </div>
                    {membership.league?.description ? (
                      <p className="mt-2 text-xs text-neutral-600">{membership.league.description}</p>
                    ) : null}
                    <div className="mt-2">
                      <Link href={`/league/${membership.league_id}`} className="text-xs font-medium text-red-700 hover:underline">
                        Open league
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {bestLeague?.league ? (
              <p className="mt-4 text-xs text-neutral-600">
                Best current league: <span className="font-semibold text-neutral-900">{bestLeague.league.name}</span> (
                {asNumber(bestLeague.season_points).toFixed(2)} points)
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
            <h2 className="text-xl font-semibold text-neutral-900">Recent Betting Snapshot</h2>
            <p className="mt-1 text-sm text-neutral-700">Most recent 20 bets across all leagues.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <article className="rounded-lg bg-neutral-100/80 px-3 py-2">
                <p className="text-xs text-neutral-500">Total Staked</p>
                <p className="text-sm font-semibold text-neutral-900">{totalStaked.toFixed(2)}</p>
              </article>
              <article className="rounded-lg bg-neutral-100/80 px-3 py-2">
                <p className="text-xs text-neutral-500">Pending Bets</p>
                <p className="text-sm font-semibold text-neutral-900">{pendingBets}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-300/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur">
          <h2 className="text-xl font-semibold text-neutral-900">Bet History</h2>
          <p className="mt-1 text-sm text-neutral-700">Recent bets with race and market context.</p>

          {bets.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">No bets placed yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.08em] text-neutral-500">
                    <th className="border-b border-neutral-200 px-3 py-2">Placed</th>
                    <th className="border-b border-neutral-200 px-3 py-2">League</th>
                    <th className="border-b border-neutral-200 px-3 py-2">Race</th>
                    <th className="border-b border-neutral-200 px-3 py-2">Market</th>
                    <th className="border-b border-neutral-200 px-3 py-2">Stake</th>
                    <th className="border-b border-neutral-200 px-3 py-2">Status</th>
                    <th className="border-b border-neutral-200 px-3 py-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((bet) => (
                    <tr key={bet.id} className="border-b border-neutral-100">
                      <td className="px-3 py-2 text-neutral-700">{new Date(bet.placed_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-neutral-700">{bet.league?.name ?? "Unknown"}</td>
                      <td className="px-3 py-2 text-neutral-700">
                        {bet.race ? `${bet.race.name} (R${bet.race.round})` : "Unknown race"}
                      </td>
                      <td className="px-3 py-2 text-neutral-700">{bet.market?.selection_label ?? "Unknown selection"}</td>
                      <td className="px-3 py-2 text-neutral-900">{asNumber(bet.stake).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-700">{bet.status}</span>
                      </td>
                      <td className={`px-3 py-2 font-medium ${asNumber(bet.net_profit) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {asNumber(bet.net_profit).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div>
          <ProfileForm />
        </div>
      </div>
    </main>
  );
}
