const OPENF1_BASE_URL = "https://api.openf1.org/v1";

export interface OpenF1RaceSession {
  session_key: number;
  session_name?: string;
  country_name?: string;
  date_start?: string;
  date_end?: string;
  location?: string;
  meeting_name?: string;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchOpenF1RaceSessionsForSeason(season: number) {
  const url = new URL(`${OPENF1_BASE_URL}/sessions`);
  url.searchParams.set("session_name", "Race");
  url.searchParams.set("year", String(season));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenF1 schedule fetch failed (${response.status})`);
  }

  const sessions = (await response.json()) as OpenF1RaceSession[];
  const deduped = new Map<string, OpenF1RaceSession>();

  for (const session of sessions) {
    const key = `${session.meeting_name ?? ""}:${session.date_start ?? ""}:${session.country_name ?? ""}`;
    if (!deduped.has(key)) {
      deduped.set(key, session);
    }
  }

  return [...deduped.values()].sort((a, b) => {
    const startA = new Date(a.date_start ?? "").getTime();
    const startB = new Date(b.date_start ?? "").getTime();
    return startA - startB;
  });
}

export function sessionToRaceRow(args: {
  season: number;
  round: number;
  session: OpenF1RaceSession;
  previousStatus?: "scheduled" | "locked" | "settling" | "settled";
  previousResultRevision?: number;
}) {
  const { season, round, session, previousStatus, previousResultRevision } = args;

  if (!session.date_start) {
    return null;
  }

  const meeting = session.meeting_name?.trim();
  const country = session.country_name?.trim();
  const location = session.location?.trim();
  const raceName = meeting?.toLowerCase().includes("grand prix")
    ? meeting
    : `${meeting ?? country ?? `Round ${round}`} Grand Prix`.replace(/\s+/g, " ").trim();

  const startTime = new Date(session.date_start);
  const lockTime = new Date(startTime.getTime() - 2 * 60 * 60 * 1000);
  const nowMs = Date.now();
  const calculatedStatus = lockTime.getTime() <= nowMs ? "locked" : "scheduled";
  const status =
    previousStatus && (previousStatus === "settling" || previousStatus === "settled") ? previousStatus : calculatedStatus;

  const slugBase = normalize(raceName.replace(/grand prix/gi, "").trim() || `round-${round}`);

  return {
    season,
    round,
    slug: `${season}-${slugBase}-grand-prix`,
    name: raceName,
    country: country ?? null,
    circuit: location ?? null,
    start_time: startTime.toISOString(),
    lock_time: lockTime.toISOString(),
    status,
    result_revision: previousResultRevision ?? 0,
  };
}
