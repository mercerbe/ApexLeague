const ODDS_API_BASE_URL = "https://api.the-odds-api.com/v4";

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
}

export interface OddsApiOutcome {
  name: string;
  price: number;
}

export interface OddsApiMarket {
  key: string;
  last_update?: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEventOdds extends OddsApiEvent {
  bookmakers: OddsApiBookmaker[];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapMarketType(marketKey: string) {
  const key = marketKey.toLowerCase();

  if (key.includes("podium")) {
    return { marketType: "podium_finish", suffix: "_podium" };
  }

  if (key.includes("fastest")) {
    return { marketType: "fastest_lap", suffix: "_fastest_lap" };
  }

  if (key.includes("top_6") || key.includes("top6")) {
    return { marketType: "top_6_finish", suffix: "_top6" };
  }

  if (key.includes("top_10") || key.includes("top10")) {
    return { marketType: "top_10_finish", suffix: "_top10" };
  }

  return { marketType: "race_winner", suffix: "_win" };
}

export function selectionKeyForOutcome(outcomeName: string, marketKey: string) {
  const normalizedName = normalize(outcomeName);
  const { suffix } = mapMarketType(marketKey);
  return `${normalizedName}${suffix}`;
}

export function marketTypeForOddsKey(marketKey: string) {
  return mapMarketType(marketKey).marketType;
}

export async function fetchOddsApiEvents(args: { apiKey: string; sportKey: string }) {
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${args.sportKey}/events`);
  url.searchParams.set("apiKey", args.apiKey);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`The Odds API events fetch failed (${response.status})`);
  }

  return (await response.json()) as OddsApiEvent[];
}

export async function fetchOddsApiEventOdds(args: {
  apiKey: string;
  sportKey: string;
  eventId: string;
  regions: string;
  markets: string;
  bookmaker?: string;
}) {
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${args.sportKey}/events/${args.eventId}/odds`);
  url.searchParams.set("apiKey", args.apiKey);
  url.searchParams.set("regions", args.regions);
  url.searchParams.set("markets", args.markets);
  url.searchParams.set("oddsFormat", "decimal");

  if (args.bookmaker) {
    url.searchParams.set("bookmakers", args.bookmaker);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`The Odds API odds fetch failed (${response.status})`);
  }

  return (await response.json()) as OddsApiEventOdds;
}
