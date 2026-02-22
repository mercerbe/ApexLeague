import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureUserProfile(supabase: SupabaseClient, user: User) {
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
  });

  if (error) {
    throw new Error(`Unable to ensure user profile: ${error.message}`);
  }
}
