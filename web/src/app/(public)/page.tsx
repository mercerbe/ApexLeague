import { redirect } from "next/navigation";
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

  if (user) {
    redirect("/profile");
  }

  return (
    <main className={`${bodyFont.className} min-h-screen bg-[radial-gradient(circle_at_15%_20%,#ffeab6_0%,transparent_40%),radial-gradient(circle_at_85%_10%,#ffd1a8_0%,transparent_38%),linear-gradient(170deg,#f7f6f3_0%,#ebe9e2_45%,#dfddd5_100%)] text-neutral-900`}>
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="inline-flex rounded-full border border-amber-700/20 bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-900">
            2026 Formula 1 Challenge
          </p>
          <h1 className={`${displayFont.className} mt-4 text-6xl leading-[0.9] tracking-wide text-neutral-950 sm:text-7xl lg:text-8xl`}>
            APEX
            <span className="block text-red-600">LEAGUE</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-neutral-700 sm:text-lg">
            Join your friends, draft race predictions with a 100-token bankroll each Grand Prix weekend, and compete for league bragging rights all season.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="/auth/login?next=/profile"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Sign In With Google
            </a>
            <a
              href="/auth/login?next=/marketplace"
              className="rounded-lg border border-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
            >
              Browse Marketplace
            </a>
            <a
              href="#how-it-works"
              className="rounded-lg border border-neutral-300 bg-white/60 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-white"
            >
              How It Works
            </a>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Bankroll</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">100 Tokens</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Race Cycle</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">Weekly Bets</p>
            </article>
            <article className="rounded-xl border border-white/50 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Competition</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">League vs League</p>
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

            <div className="race-track mt-6">
              <div className="race-track__lane" />
              <div className="race-track__lane-inner" />
              <div className="race-track__car" />
              <div className="race-track__car-shadow" />
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
              <p className="mt-2 text-sm text-neutral-700">Distribute tokens across race markets before lock time.</p>
            </article>
            <article className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold text-red-600">3. Climb The Board</p>
              <p className="mt-2 text-sm text-neutral-700">Scores settle from results and update league standings.</p>
            </article>
          </div>
        </div>
      </section>

      <style>{`
        .race-track {
          position: relative;
          height: 220px;
          border-radius: 999px;
          background: linear-gradient(135deg, #1f1f1f 0%, #0d0d0d 100%);
          overflow: hidden;
        }

        .race-track__lane,
        .race-track__lane-inner {
          position: absolute;
          inset: 16px;
          border-radius: 999px;
          border: 2px dashed rgba(255, 255, 255, 0.4);
          animation: laneMove 3s linear infinite;
        }

        .race-track__lane-inner {
          inset: 46px;
          border-color: rgba(255, 255, 255, 0.28);
          animation-direction: reverse;
        }

        .race-track__car,
        .race-track__car-shadow {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 18px;
          height: 18px;
          margin: -9px;
          border-radius: 999px;
          transform-origin: 0 0;
          animation: orbit 4.5s linear infinite;
        }

        .race-track__car {
          background: #f52929;
          box-shadow: 0 0 0 5px rgba(245, 41, 41, 0.25);
        }

        .race-track__car-shadow {
          background: rgba(0, 0, 0, 0.25);
          filter: blur(4px);
          animation-delay: -0.18s;
        }

        @keyframes orbit {
          0% {
            transform: rotate(0deg) translateX(84px) scale(1);
          }
          50% {
            transform: rotate(180deg) translateX(84px) scale(0.88);
          }
          100% {
            transform: rotate(360deg) translateX(84px) scale(1);
          }
        }

        @keyframes laneMove {
          0% {
            border-style: dashed;
            border-color: rgba(255, 255, 255, 0.45);
          }
          50% {
            border-color: rgba(255, 255, 255, 0.2);
          }
          100% {
            border-style: dashed;
            border-color: rgba(255, 255, 255, 0.45);
          }
        }
      `}</style>
    </main>
  );
}
