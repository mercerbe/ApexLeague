import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { AcceptInviteButton } from "@/app/invite/[token]/accept-invite-button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

interface InviteRecord {
  id: string;
  league_id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_by_user_id: string | null;
  league: { name: string; description: string | null } | null;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const parsedParams = z.object({ token: z.string().uuid() }).safeParse(await params);

  if (!parsedParams.success) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Invalid Invite Link</h1>
        <p className="text-neutral-600">This invite token is not valid.</p>
      </main>
    );
  }

  const { token } = parsedParams.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const userEmail = user.email?.toLowerCase() ?? "";

  let service;

  try {
    service = createSupabaseServiceRoleClient();
  } catch (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Invite Service Unavailable</h1>
        <p className="text-neutral-600">
          {error instanceof Error ? error.message : "Could not initialize invite service."}
        </p>
      </main>
    );
  }

  const { data: invite, error: inviteError } = await service
    .from("league_invites")
    .select("id, league_id, invitee_email, status, expires_at, accepted_by_user_id, league:leagues(name, description)")
    .eq("token", token)
    .maybeSingle<InviteRecord>();

  if (inviteError || !invite) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Invite Not Found</h1>
        <p className="text-neutral-600">This invite link does not exist or has already been removed.</p>
      </main>
    );
  }

  if (invite.invitee_email.toLowerCase() !== userEmail) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Wrong Account</h1>
        <p className="text-neutral-600">
          This invite was sent to {invite.invitee_email}. You are signed in as {user.email ?? "unknown"}.
        </p>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700" type="submit">
            Sign out
          </button>
        </form>
      </main>
    );
  }

  const status = invite.status;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">League Invite</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{invite.league?.name ?? "Apex League"}</h1>
        <p className="mt-2 text-neutral-600">{invite.league?.description ?? "Join this league and start competing."}</p>
        <p className="mt-3 text-sm text-neutral-500">Invite email: {invite.invitee_email}</p>

        {status === "pending" ? (
          <div className="mt-5">
            <AcceptInviteButton token={token} leagueId={invite.league_id} />
          </div>
        ) : null}

        {status === "accepted" ? (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            This invite has already been accepted.
            <div className="mt-2">
              <Link href={`/league/${invite.league_id}`} className="font-medium underline">
                Go to league
              </Link>
            </div>
          </div>
        ) : null}

        {status === "expired" ? (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This invite has expired. Ask your league admin for a new invite link.
          </p>
        ) : null}

        {status === "revoked" ? (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            This invite has been revoked by the league admins.
          </p>
        ) : null}
      </section>
    </main>
  );
}
