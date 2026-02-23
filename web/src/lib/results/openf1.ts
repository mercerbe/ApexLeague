const OPENF1_BASE_URL = "https://api.openf1.org/v1";

export interface OpenF1Session {
  session_key: number;
  session_name?: string;
  country_name?: string;
  date_start?: string;
  date_end?: string;
  location?: string;
  meeting_name?: string;
}

export interface OpenF1SessionResult {
  driver_number: number;
  position: number | null;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
}

export interface OpenF1Driver {
  driver_number: number;
  full_name?: string;
  last_name?: string;
  name_acronym?: string;
}

export interface OpenF1Lap {
  driver_number: number;
  lap_duration: number | null;
}

async function fetchOpenF1<T>(pathname: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${OPENF1_BASE_URL}${pathname}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenF1 request failed (${response.status}): ${url}`);
  }

  return (await response.json()) as T;
}

function toMillis(value?: string) {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

export async function findBestRaceSessionForRace(race: {
  season: number;
  country?: string | null;
  name: string;
  start_time: string;
}) {
  const candidates: OpenF1Session[] = [];

  const byCountry = await fetchOpenF1<OpenF1Session[]>("/sessions", {
    session_name: "Race",
    year: race.season,
    country_name: race.country ?? undefined,
  }).catch(() => []);

  candidates.push(...byCountry);

  if (candidates.length === 0) {
    const byYear = await fetchOpenF1<OpenF1Session[]>("/sessions", {
      session_name: "Race",
      year: race.season,
    }).catch(() => []);

    candidates.push(...byYear);
  }

  if (candidates.length === 0) {
    return null;
  }

  const raceStartMillis = toMillis(race.start_time);

  const scored = candidates
    .map((session) => {
      const sessionStartMillis = toMillis(session.date_start);
      const distance = Math.abs(sessionStartMillis - raceStartMillis);

      const label = [session.meeting_name, session.location, session.country_name].join(" ").toLowerCase();
      const raceName = race.name.toLowerCase();
      const nameBias = label.includes(raceName.replace(" grand prix", "")) ? -1_000_000 : 0;

      return {
        session,
        score: Number.isFinite(distance) ? distance + nameBias : Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.score - b.score);

  return scored[0]?.session ?? null;
}

export async function getSessionResults(sessionKey: number) {
  return fetchOpenF1<OpenF1SessionResult[]>("/session_result", {
    session_key: sessionKey,
  });
}

export async function getSessionDrivers(sessionKey: number) {
  return fetchOpenF1<OpenF1Driver[]>("/drivers", {
    session_key: sessionKey,
  });
}

export async function getSessionLaps(sessionKey: number) {
  return fetchOpenF1<OpenF1Lap[]>("/laps", {
    session_key: sessionKey,
  });
}

export function isSessionFinalized(session: OpenF1Session) {
  if (!session.date_end) {
    return false;
  }

  return new Date(session.date_end).getTime() <= Date.now();
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildDriverAliasMap(drivers: OpenF1Driver[]) {
  const aliasMap = new Map<string, number>();

  for (const driver of drivers) {
    const aliases = new Set<string>();

    if (driver.full_name) {
      aliases.add(normalize(driver.full_name));
    }

    if (driver.last_name) {
      aliases.add(normalize(driver.last_name));
    }

    if (driver.name_acronym) {
      aliases.add(normalize(driver.name_acronym));
    }

    const full = normalize(driver.full_name ?? "");
    if (full.includes("_")) {
      full
        .split("_")
        .filter(Boolean)
        .forEach((token) => aliases.add(token));
    }

    aliases.forEach((alias) => aliasMap.set(alias, driver.driver_number));
  }

  return aliasMap;
}

export function findFastestLapDriverNumber(laps: OpenF1Lap[]) {
  let fastestDriver: number | null = null;
  let bestDuration = Number.POSITIVE_INFINITY;

  for (const lap of laps) {
    if (!lap.lap_duration || lap.lap_duration <= 0) {
      continue;
    }

    if (lap.lap_duration < bestDuration) {
      bestDuration = lap.lap_duration;
      fastestDriver = lap.driver_number;
    }
  }

  return fastestDriver;
}

export function marketSelectionToDriverNumber(selectionKey: string, aliasMap: Map<string, number>) {
  const normalized = normalize(selectionKey);

  const withoutSuffix = normalized
    .replace(/_win$/, "")
    .replace(/_podium$/, "")
    .replace(/_top6$/, "")
    .replace(/_top_6$/, "")
    .replace(/_top10$/, "")
    .replace(/_top_10$/, "")
    .replace(/_fastest_lap$/, "");

  const tokens = withoutSuffix.split("_").filter(Boolean);

  for (let size = tokens.length; size >= 1; size -= 1) {
    const candidate = tokens.slice(0, size).join("_");

    const driverNumber = aliasMap.get(candidate);
    if (driverNumber != null) {
      return driverNumber;
    }
  }

  for (const token of tokens) {
    const driverNumber = aliasMap.get(token);
    if (driverNumber != null) {
      return driverNumber;
    }
  }

  return null;
}
