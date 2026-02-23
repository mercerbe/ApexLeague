import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const displayFont = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className={`${bodyFont.className} min-h-screen bg-[radial-gradient(circle_at_15%_20%,#ffeab6_0%,transparent_40%),radial-gradient(circle_at_85%_10%,#ffd1a8_0%,transparent_38%),linear-gradient(170deg,#f7f6f3_0%,#ebe9e2_45%,#dfddd5_100%)] text-neutral-900`}>
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="inline-flex rounded-full border border-amber-700/20 bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-900">
            Formula 1 Challenge
          </p>
          <h1 className={`${displayFont.className} mt-4 text-6xl leading-[0.9] tracking-wide text-neutral-950 sm:text-7xl lg:text-8xl`}>
            APEX
            <span className="block text-red-600">LEAGUE</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-neutral-700 sm:text-lg">
            Join your friends, draft race predictions with a 100-token bankroll per race, follow the official F1 season schedule, and compete against other members in your league all season.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {user ? (
              <a href="/profile" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
                Open Dashboard
              </a>
            ) : (
              <a
                href="/auth/login?next=/profile"
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Sign In With Google
              </a>
            )}
            <a
              href="/marketplace"
              className="rounded-lg border border-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
            >
              Leagues Hub
            </a>
            <a
              href="/leaderboard"
              className="rounded-lg border border-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
            >
              Leaderboard
            </a>
            <a
              href="/how-it-works"
              className="rounded-lg border border-neutral-300 bg-white/60 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-white"
            >
              How It Works
            </a>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Bankroll</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">100 Tokens / Race</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Race Cycle</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">Official F1 Schedule</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Competition</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">Members In-League</p>
            </article>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -left-8 -top-8 h-20 w-20 rounded-full bg-red-500/20 blur-2xl" />
          <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-3xl border border-neutral-300/70 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">Live Season Simulation</p>
            <h2 className="mt-2 text-2xl font-bold text-neutral-900">Race Your Predictions</h2>
            <p className="mt-2 text-sm text-neutral-600">Make picks before lock, climb standings after settlement.</p>

            <div className="race-track mt-6" aria-hidden>
              <svg className="race-track__svg" viewBox="0 0 620 260" role="img">
                <defs>
                  <linearGradient id="trackBg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1c1c1c" />
                    <stop offset="100%" stopColor="#090909" />
                  </linearGradient>
                  <filter id="trackGlow" x="-25%" y="-25%" width="150%" height="150%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <rect x="8" y="8" width="604" height="244" rx="44" fill="url(#trackBg)" />

                <path
                  d="M66 214 L548 214 C578 214 594 196 594 166 L594 126 L574 126 L574 106 C574 94 568 85 557 82 L522 72 C499 65 484 66 472 78 C464 86 462 94 468 104 L486 122 C492 129 490 136 483 140 C476 144 470 143 463 137 L348 66 C326 52 300 55 284 77 L238 143 C232 152 222 158 211 160 L158 160 C143 160 132 151 132 138 C132 125 143 116 158 116 L194 116 C217 116 236 99 236 76 C236 53 217 40 194 40 L98 40 C60 40 28 71 28 108 C28 138 48 158 78 166 C93 170 102 181 102 196 C102 208 92 214 80 214 Z"
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="30"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  id="circuitPath"
                  d="M66 214 L548 214 C578 214 594 196 594 166 L594 126 L574 126 L574 106 C574 94 568 85 557 82 L522 72 C499 65 484 66 472 78 C464 86 462 94 468 104 L486 122 C492 129 490 136 483 140 C476 144 470 143 463 137 L348 66 C326 52 300 55 284 77 L238 143 C232 152 222 158 211 160 L158 160 C143 160 132 151 132 138 C132 125 143 116 158 116 L194 116 C217 116 236 99 236 76 C236 53 217 40 194 40 L98 40 C60 40 28 71 28 108 C28 138 48 158 78 166 C93 170 102 181 102 196 C102 208 92 214 80 214 Z"
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="3"
                  strokeDasharray="7 7"
                  strokeLinecap="round"
                  filter="url(#trackGlow)"
                />

                <g>
                  <g transform="translate(-12,-6)">
                    <rect x="2" y="4" width="20" height="4" rx="1.5" fill="#0f0f10" />
                    <rect x="5" y="2" width="14" height="8" rx="2.5" fill="#fa2f2f" />
                    <rect x="8" y="0" width="8" height="4" rx="1.5" fill="#f6f6f6" />
                    <rect x="8" y="10" width="8" height="4" rx="1.5" fill="#f6f6f6" />
                    <circle cx="6" cy="12" r="2.4" fill="#111" />
                    <circle cx="18" cy="12" r="2.4" fill="#111" />
                  </g>
                  <animateMotion dur="6.8s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#circuitPath" />
                  </animateMotion>
                </g>
              </svg>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-neutral-900 px-3 py-2 text-white">
                <p className="text-[11px] uppercase tracking-[0.1em] text-neutral-300">Predictions</p>
                <p className="mt-1 text-sm font-semibold">Open Markets</p>
              </div>
              <div className="rounded-lg border border-neutral-300 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-neutral-500">Standings</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">Auto Updated</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="rounded-3xl border border-neutral-300/70 bg-white/70 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">How It Works</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold text-red-600">1. Pick Your League</p>
              <p className="mt-2 text-sm text-neutral-700">Create or join a league with friends and rivals.</p>
            </article>
            <article className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold text-red-600">2. Spend 100 Tokens</p>
              <p className="mt-2 text-sm text-neutral-700">Each race grants 100 fresh tokens to distribute before lock time.</p>
            </article>
            <article className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold text-red-600">3. Climb The Board</p>
              <p className="mt-2 text-sm text-neutral-700">Scores settle from official race results and update league standings.</p>
            </article>
          </div>
        </div>
      </section>

      <style>{`
        .race-track {
          position: relative;
          height: 220px;
          border-radius: 1.5rem;
          overflow: hidden;
        }

        .race-track__svg {
          display: block;
          height: 100%;
          width: 100%;
        }
      `}</style>
    </main>
  );
}
