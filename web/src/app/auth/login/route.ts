import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedNext = url.searchParams.get("next") ?? "/profile";
  const next = requestedNext.startsWith("/") ? requestedNext : "/profile";

  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", url.origin);
  redirectTo.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    const errorUrl = new URL("/auth/error", url.origin);
    errorUrl.searchParams.set("message", error?.message ?? "Unable to start Google OAuth.");
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(data.url);
}
