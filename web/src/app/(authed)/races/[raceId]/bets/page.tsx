interface RaceBetsPageProps {
  params: Promise<{ raceId: string }>;
}

export default async function RaceBetsPage({ params }: RaceBetsPageProps) {
  const { raceId } = await params;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Race {raceId} Bets</h1>
      <p className="mt-2 text-neutral-600">Market listing and bet placement form will be implemented in the API/UI build phase.</p>
    </main>
  );
}
