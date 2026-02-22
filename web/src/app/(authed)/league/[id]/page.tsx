interface LeaguePageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">League {id}</h1>
      <p className="mt-2 text-neutral-600">League detail view and realtime chat are scaffolded for step 5+.</p>
    </main>
  );
}
