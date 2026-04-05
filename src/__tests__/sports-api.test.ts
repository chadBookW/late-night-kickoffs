import { describe, it, expect } from "vitest";
import { getCurrentSeason, mapStatus, formatRound } from "@/lib/sports-api";
import {
  bangerMatch,
  snoozefestMatch,
  penaltyShootoutMatch,
  makeMatch,
} from "./fixtures/api-football-mock";

describe("getCurrentSeason", () => {
  it("returns a 4-digit year string", () => {
    const season = getCurrentSeason();
    expect(season).toMatch(/^\d{4}$/);
  });

  it("returns correct season based on current month", () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const expected = month < 7 ? String(year - 1) : String(year);
    expect(getCurrentSeason()).toBe(expected);
  });
});

describe("mapStatus", () => {
  it("maps FINISHED + REGULAR duration to FT", () => {
    expect(mapStatus(bangerMatch)).toBe("FT");
  });

  it("maps FINISHED + PENALTY_SHOOTOUT to PEN", () => {
    expect(mapStatus(penaltyShootoutMatch)).toBe("PEN");
  });

  it("maps FINISHED + EXTRA_TIME to AET", () => {
    const aetMatch = makeMatch({
      score: {
        winner: "HOME_TEAM",
        duration: "EXTRA_TIME",
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 1, away: 1 },
      },
    });
    expect(mapStatus(aetMatch)).toBe("AET");
  });

  it("passes through non-FINISHED statuses", () => {
    const scheduled = makeMatch({ status: "SCHEDULED" });
    expect(mapStatus(scheduled)).toBe("SCHEDULED");
  });
});

describe("formatRound", () => {
  it("formats REGULAR_SEASON with matchday number", () => {
    expect(formatRound(bangerMatch)).toBe("Regular Season - 30");
  });

  it("returns stage name for non-regular season", () => {
    expect(formatRound(penaltyShootoutMatch)).toBe("QUARTER_FINALS");
  });
});

describe("football-data.org match shape validation", () => {
  it("banger match has all required top-level fields", () => {
    expect(bangerMatch).toHaveProperty("id");
    expect(bangerMatch).toHaveProperty("utcDate");
    expect(bangerMatch).toHaveProperty("status");
    expect(bangerMatch).toHaveProperty("matchday");
    expect(bangerMatch).toHaveProperty("homeTeam");
    expect(bangerMatch).toHaveProperty("awayTeam");
    expect(bangerMatch).toHaveProperty("score");
    expect(bangerMatch).toHaveProperty("referees");
  });

  it("score has fullTime and halfTime", () => {
    expect(bangerMatch.score).toHaveProperty("fullTime");
    expect(bangerMatch.score).toHaveProperty("halfTime");
    expect(bangerMatch.score).toHaveProperty("winner");
    expect(bangerMatch.score).toHaveProperty("duration");
  });

  it("fullTime goals are numbers", () => {
    expect(typeof bangerMatch.score.fullTime.home).toBe("number");
    expect(typeof bangerMatch.score.fullTime.away).toBe("number");
  });

  it("snoozefest has zero goals", () => {
    expect(snoozefestMatch.score.fullTime.home).toBe(0);
    expect(snoozefestMatch.score.fullTime.away).toBe(0);
  });

  it("penalty match has PENALTY_SHOOTOUT duration", () => {
    expect(penaltyShootoutMatch.score.duration).toBe("PENALTY_SHOOTOUT");
  });

  it("teams have id, name, shortName, tla", () => {
    expect(bangerMatch.homeTeam).toHaveProperty("id");
    expect(bangerMatch.homeTeam).toHaveProperty("name");
    expect(bangerMatch.homeTeam).toHaveProperty("shortName");
    expect(bangerMatch.homeTeam).toHaveProperty("tla");
  });
});
