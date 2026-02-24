const THESPORTSDB_BASE_URL = "https://www.thesportsdb.com/api/v1/json";

export interface SportsDbEvent {
  idEvent?: string;
  strEvent?: string;
  strEventAlternate?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  intRound?: string;
  strCountry?: string;
  strVenue?: string;
  strCircuit?: string;
  strCity?: string;
  strDescriptionEN?: string;
  strThumb?: string;
  strBanner?: string;
  strPoster?: string;
  strVideo?: string;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDateTime(event: SportsDbEvent) {
  if (event.strTimestamp) {
    const parsed = new Date(event.strTimestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const date = event.dateEvent?.trim();
  if (!date) {
    return null;
  }

  const time = event.strTime?.trim() || "12:00:00";
  const candidate = new Date(`${date}T${time}Z`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate;
}

function parseRound(raw: string | undefined, fallbackRound: number) {
  const parsed = Number(raw ?? "");
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallbackRound;
}

export async function fetchSportsDbSeasonEvents(args: { apiKey: string; leagueId: string; season: number }) {
  const url = new URL(`${THESPORTSDB_BASE_URL}/${args.apiKey}/eventsseason.php`);
  url.searchParams.set("id", args.leagueId);
  url.searchParams.set("s", String(args.season));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TheSportsDB schedule fetch failed (${response.status})`);
  }

  const payload = (await response.json()) as { events?: SportsDbEvent[] | null };
  const events = payload.events ?? [];

  return events;
}

export function eventToRaceRow(args: {
  season: number;
  fallbackRound: number;
  event: SportsDbEvent;
  previousStatus?: "scheduled" | "locked" | "settling" | "settled";
  previousResultRevision?: number;
}) {
  const { season, fallbackRound, event, previousStatus, previousResultRevision } = args;
  const start = parseDateTime(event);
  if (!start) {
    return null;
  }

  const round = parseRound(event.intRound, fallbackRound);
  const name = event.strEvent?.trim() || event.strEventAlternate?.trim() || `Round ${round} Grand Prix`;
  const lockTime = new Date(start.getTime() - 2 * 60 * 60 * 1000);
  const nowMs = Date.now();
  const calculatedStatus = lockTime.getTime() <= nowMs ? "locked" : "scheduled";
  const status =
    previousStatus && (previousStatus === "settling" || previousStatus === "settled") ? previousStatus : calculatedStatus;

  const slugBase = normalize(name.replace(/grand prix/gi, "").trim() || `round-${round}`);

  return {
    season,
    round,
    slug: `${season}-${slugBase}-grand-prix`,
    name,
    country: event.strCountry?.trim() || null,
    circuit: event.strCircuit?.trim() || event.strVenue?.trim() || null,
    start_time: start.toISOString(),
    lock_time: lockTime.toISOString(),
    status,
    result_revision: previousResultRevision ?? 0,
    sportsdb_event_id: event.idEvent?.trim() || null,
    venue_name: event.strVenue?.trim() || null,
    city: event.strCity?.trim() || null,
    timezone: "UTC",
    race_description: event.strDescriptionEN?.trim() || null,
    image_url: event.strThumb?.trim() || null,
    banner_url: event.strBanner?.trim() || null,
    poster_url: event.strPoster?.trim() || null,
    highlights_url: event.strVideo?.trim() || null,
  };
}
