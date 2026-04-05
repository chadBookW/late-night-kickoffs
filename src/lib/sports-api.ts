const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN || "";
const BASE_URL = "https://api.football-data.org/v4";

async function apiFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN },
  });

  if (!res.ok) {
    throw new Error(`football-data.org error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json as T;
}

// ── Types for football-data.org v4 responses ──

export type FDTeam = {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
};

export type FDScore = {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
};

export type FDReferee = {
  id: number;
  name: string;
  type: string;
  nationality: string;
};

export type FDMatch = {
  id: number;
  utcDate: string;
  status: "FINISHED" | "SCHEDULED" | "LIVE" | "IN_PLAY" | "PAUSED" | "POSTPONED" | "SUSPENDED" | "CANCELLED";
  matchday: number;
  stage: string;
  group: string | null;
  lastUpdated: string;
  area: { id: number; name: string; code: string; flag: string };
  competition: { id: number; name: string; code: string; type: string; emblem: string };
  season: { id: number; startDate: string; endDate: string; currentMatchday: number; winner: unknown };
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: FDScore;
  referees: FDReferee[];
};

type FDMatchesResponse = {
  matches: FDMatch[];
  resultSet: { count: number; competitions: string; first: string; last: string; played: number };
  filters: Record<string, unknown>;
};

// ── Public API ──

/**
 * Fetch finished matches for a competition on a given date.
 * Uses competition code (e.g. "PL", "CL", "BL1") not numeric ID.
 * football-data.org returns matches with scores, teams, matchday — no events/stats.
 * Cost: 1 API call per competition per date range.
 */
export async function getFinishedMatches(
  competitionCode: string,
  dateStr: string
): Promise<FDMatch[]> {
  const data = await apiFetch<FDMatchesResponse>(
    `/competitions/${competitionCode}/matches`,
    {
      dateFrom: dateStr,
      dateTo: dateStr,
      status: "FINISHED",
    }
  );
  return data.matches || [];
}

/**
 * Fetch finished matches for a competition in a date range.
 */
export async function getFinishedMatchesRange(
  competitionCode: string,
  dateFrom: string,
  dateTo: string
): Promise<FDMatch[]> {
  const data = await apiFetch<FDMatchesResponse>(
    `/competitions/${competitionCode}/matches`,
    {
      dateFrom,
      dateTo,
      status: "FINISHED",
    }
  );
  return data.matches || [];
}

/**
 * Map football-data.org status to our internal status codes.
 * We use short status codes in DB: FT, AET, PEN.
 */
export function mapStatus(match: FDMatch): string {
  if (match.status !== "FINISHED") return match.status;
  if (match.score.duration === "PENALTY_SHOOTOUT") return "PEN";
  if (match.score.duration === "EXTRA_TIME") return "AET";
  return "FT";
}

/**
 * Format the round/stage string for matchweek parsing.
 * football-data.org uses "REGULAR_SEASON" stage + matchday number.
 */
export function formatRound(match: FDMatch): string {
  if (match.stage === "REGULAR_SEASON") {
    return `Regular Season - ${match.matchday}`;
  }
  return match.stage;
}

// Helper: get current PL season year (e.g., "2025" for the 2025-26 season)
export function getCurrentSeason(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  // PL season starts in August; if before August, use previous year
  return month < 7 ? String(year - 1) : String(year);
}
