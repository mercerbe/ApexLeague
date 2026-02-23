import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MarketplaceClient } from "@/app/(authed)/marketplace/marketplace-client";

export default async function PublicMarketplacePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <MarketplaceClient isAuthenticated={Boolean(user)} />;
}
