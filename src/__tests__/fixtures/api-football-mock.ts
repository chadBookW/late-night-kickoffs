import type { FDMatch } from "@/lib/sports-api";

// ── Helper builder ──

function makeMatch(overrides: Partial<FDMatch> = {}): FDMatch {
  return {
    id: 1001,
    utcDate: "2025-04-03T20:00:00Z",
    status: "FINISHED",
    matchday: 30,
    stage: "REGULAR_SEASON",
    group: null,
    lastUpdated: "2025-04-04T00:20:59Z",
    area: { id: 2072, name: "England", code: "ENG", flag: "" },
    competition: { id: 2021, name: "Premier League", code: "PL", type: "LEAGUE", emblem: "" },
    season: { id: 2403, startDate: "2024-08-15", endDate: "2025-05-24", currentMatchday: 30, winner: null },
    homeTeam: { id: 33, name: "Manchester United FC", shortName: "Man United", tla: "MUN", crest: "" },
    awayTeam: { id: 40, name: "Liverpool FC", shortName: "Liverpool", tla: "LIV", crest: "" },
    score: {
      winner: "AWAY_TEAM",
      duration: "REGULAR",
      fullTime: { home: 2, away: 3 },
      halfTime: { home: 1, away: 1 },
    },
    referees: [{ id: 11605, name: "Michael Oliver", type: "REFEREE", nationality: "England" }],
    ...overrides,
  };
}

// ── Banger: 5 goals, comeback (trailing 1-2 at HT, won 3-2), 2nd half drama ──

export const bangerMatch: FDMatch = makeMatch({
  id: 2001,
  homeTeam: { id: 33, name: "Manchester United FC", shortName: "Man United", tla: "MUN", crest: "" },
  awayTeam: { id: 40, name: "Liverpool FC", shortName: "Liverpool", tla: "LIV", crest: "" },
  score: {
    winner: "HOME_TEAM",
    duration: "REGULAR",
    fullTime: { home: 3, away: 2 },
    halfTime: { home: 1, away: 2 },
  },
});

// ── Worth-a-watch: 1-1 draw, comeback from 0-1 HT ──

export const worthAWatchMatch: FDMatch = makeMatch({
  id: 2002,
  homeTeam: { id: 50, name: "Manchester City FC", shortName: "Man City", tla: "MCI", crest: "" },
  awayTeam: { id: 47, name: "Tottenham Hotspur FC", shortName: "Tottenham", tla: "TOT", crest: "" },
  score: {
    winner: "DRAW",
    duration: "REGULAR",
    fullTime: { home: 1, away: 1 },
    halfTime: { home: 0, away: 1 },
  },
});

// ── Snoozefest: 0-0, no action ──

export const snoozefestMatch: FDMatch = makeMatch({
  id: 2003,
  homeTeam: { id: 44, name: "Burnley FC", shortName: "Burnley", tla: "BUR", crest: "" },
  awayTeam: { id: 62, name: "Sheffield United FC", shortName: "Sheffield Utd", tla: "SHU", crest: "" },
  score: {
    winner: "DRAW",
    duration: "REGULAR",
    fullTime: { home: 0, away: 0 },
    halfTime: { home: 0, away: 0 },
  },
});

// ── Penalty shootout: 2-2 after extra time, penalties decided it ──

export const penaltyShootoutMatch: FDMatch = makeMatch({
  id: 2004,
  stage: "QUARTER_FINALS",
  score: {
    winner: "HOME_TEAM",
    duration: "PENALTY_SHOOTOUT",
    fullTime: { home: 2, away: 2 },
    halfTime: { home: 1, away: 0 },
  },
});

export { makeMatch };
