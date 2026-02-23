import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/profile/ensure-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const leagueIdParamsSchema = z.object({
  leagueId: z.string().uuid(),
});

const getMessagesQuerySchema = z.object({
  limit: z
    .coerce.number()
    .int()
    .min(1)
    .max(200)
    .default(50),
  sort: z.enum(["recent", "active_threads"]).default("recent"),
});

const createMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  parent_message_id: z.string().uuid().nullable().optional(),
});

interface PostgresError {
  code?: string;
  message: string;
}

async function requireAuthedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null as null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user, error: null as NextResponse<unknown> | null };
}

export async function GET(request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const parsedParams = leagueIdParamsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedQuery = getMessagesQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters.", details: parsedQuery.error.flatten() }, { status: 400 });
  }

  const { leagueId } = parsedParams.data;
  const { limit, sort } = parsedQuery.data;

  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("league_messages")
    .select("id, league_id, user_id, parent_message_id, body, created_at, profile:profiles(handle)")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const typedError = error as PostgresError;

    if (typedError.code === "42501") {
      return NextResponse.json({ error: "You are not a member of this league." }, { status: 403 });
    }

    return NextResponse.json({ error: typedError.message }, { status: 500 });
  }

  const messages = data ?? [];

  if (sort === "recent") {
    return NextResponse.json({ messages });
  }

  const latestActivityByParent = new Map<string, number>();

  for (const message of messages) {
    const createdAt = new Date(message.created_at).getTime();
    const parentKey = message.parent_message_id ?? message.id;
    const existing = latestActivityByParent.get(parentKey) ?? 0;
    if (createdAt > existing) {
      latestActivityByParent.set(parentKey, createdAt);
    }
  }

  const sorted = [...messages].sort((a, b) => {
    const parentA = a.parent_message_id ?? a.id;
    const parentB = b.parent_message_id ?? b.id;
    const latestA = latestActivityByParent.get(parentA) ?? 0;
    const latestB = latestActivityByParent.get(parentB) ?? 0;
    if (latestA !== latestB) {
      return latestB - latestA;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json({ messages: sorted });
}

export async function POST(request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const parsedParams = leagueIdParamsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid league id." }, { status: 400 });
  }

  let payload: z.infer<typeof createMessageSchema>;

  try {
    const json = await request.json();
    payload = createMessageSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { leagueId } = parsedParams.data;
  const parentMessageId = payload.parent_message_id ?? null;
  const auth = await requireAuthedUser();

  if (auth.error) {
    return auth.error;
  }

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUserProfile(auth.supabase, auth.user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Profile bootstrap failed" }, { status: 500 });
  }

  if (parentMessageId) {
    const { data: parent, error: parentError } = await auth.supabase
      .from("league_messages")
      .select("id, league_id")
      .eq("id", parentMessageId)
      .single<{ id: string; league_id: string }>();

    if (parentError || !parent) {
      return NextResponse.json({ error: "Parent message not found." }, { status: 404 });
    }

    if (parent.league_id !== leagueId) {
      return NextResponse.json({ error: "Parent message belongs to a different league." }, { status: 400 });
    }
  }

  const { data, error } = await auth.supabase
    .from("league_messages")
    .insert({
      league_id: leagueId,
      user_id: auth.user.id,
      body: payload.body,
      parent_message_id: parentMessageId,
    })
    .select("id, league_id, user_id, parent_message_id, body, created_at, profile:profiles(handle)")
    .single();

  if (error || !data) {
    const typedError = error as PostgresError | null;

    if (typedError?.code === "42501") {
      return NextResponse.json({ error: "You are not a member of this league." }, { status: 403 });
    }

    return NextResponse.json({ error: typedError?.message ?? "Failed to create message." }, { status: 500 });
  }

  return NextResponse.json({ message: data }, { status: 201 });
}
