import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeaguesClient } from "@/app/(public)/leagues/unified-leagues-client";

export default async function LeaguesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LeaguesClient isAuthenticated={Boolean(user)} currentUserId={user?.id ?? null} />;
}
