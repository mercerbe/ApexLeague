import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteNav() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Link href="/" className="text-sm font-medium uppercase tracking-[0.12em] text-neutral-700 hover:text-neutral-900">
            Apex League
          </Link>
          <Link href="/how-it-works" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            How It Works
          </Link>
          <Link href="/leagues" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            Leagues
          </Link>
          <Link href="/leaderboard" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            Leaderboard
          </Link>
          {user ? (
            <>
              <Link href="/races" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                Races
              </Link>
              <Link href="/profile" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                Profile
              </Link>
            </>
          ) : null}
        </nav>

        {user ? (
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Sign out
            </button>
          </form>
        ) : (
          <a
            href="/auth/login?next=/profile"
            className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black"
          >
            Sign in
          </a>
        )}
      </div>
    </header>
  );
}
