export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.18em] text-neutral-500">Apex League</p>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">Formula 1 League Betting for the 2026 season</h1>
        <p className="max-w-2xl text-lg text-neutral-600">
          Log in with Google, join a league, place race predictions with a 100-point bankroll, and climb the standings.
        </p>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-medium text-neutral-900">Authentication</h2>
        <p className="mt-2 text-neutral-600">
          Google OAuth wiring is the next step. This screen is intentionally a placeholder for the auth flow.
        </p>
      </section>
    </main>
  );
}
