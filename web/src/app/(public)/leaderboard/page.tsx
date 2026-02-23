import { LeaderboardClient } from "@/app/(public)/leaderboard/leaderboard-client";

export default function LeaderboardPage() {
  const initialSeason = new Date().getUTCFullYear();

  return <LeaderboardClient initialSeason={initialSeason} />;
}
