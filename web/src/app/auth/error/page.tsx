import Link from "next/link";

interface AuthErrorPageProps {
  searchParams: Promise<{ message?: string }>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { message } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Authentication Error</h1>
      <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        {message ?? "An unknown authentication error occurred."}
      </p>
      <Link
        href="/"
        className="inline-flex w-fit items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Return Home
      </Link>
    </main>
  );
}
