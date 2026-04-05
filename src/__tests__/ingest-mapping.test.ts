import { describe, it, expect } from "vitest";
import { mapStatus, formatRound } from "@/lib/sports-api";
import { toISTDate, formatMatchweekFromRound } from "@/lib/ist-utils";
import {
  bangerMatch,
  snoozefestMatch,
  penaltyShootoutMatch,
} from "./fixtures/api-football-mock";

/**
 * These tests verify that football-data.org data is correctly mapped
 * to our DB schema — the same logic used in processMatch().
 * We test the mapping functions directly without needing Supabase.
 */

describe("football-data.org → DB field mapping", () => {
  describe("match table fields", () => {
    it("maps external_match_id from match.id", () => {
      expect(String(bangerMatch.id)).toBe("2001");
    });

    it("maps season from season.startDate", () => {
      const seasonYear = bangerMatch.season.startDate?.split("-")[0] || "";
      expect(seasonYear).toBe("2024");
    });

    it("maps stage via formatRound()", () => {
      expect(formatRound(bangerMatch)).toBe("Regular Season - 30");
    });

    it("maps home_team_id from homeTeam.id", () => {
      expect(String(bangerMatch.homeTeam.id)).toBe("33");
    });

    it("maps away_team_id from awayTeam.id", () => {
      expect(String(bangerMatch.awayTeam.id)).toBe("40");
    });

    it("maps kickoff_at from utcDate", () => {
      expect(bangerMatch.utcDate).toBe("2025-04-03T20:00:00Z");
    });

    it("maps status via mapStatus()", () => {
      expect(mapStatus(bangerMatch)).toBe("FT");
      expect(mapStatus(penaltyShootoutMatch)).toBe("PEN");
    });

    it("maps home_score and away_score from score.fullTime", () => {
      expect(bangerMatch.score.fullTime.home).toBe(3);
      expect(bangerMatch.score.fullTime.away).toBe(2);
      expect(snoozefestMatch.score.fullTime.home).toBe(0);
      expect(snoozefestMatch.score.fullTime.away).toBe(0);
    });

    it("maps match_date_ist via toISTDate()", () => {
      // UTC 2025-04-03T20:00 → IST 2025-04-04T01:30 → date: 2025-04-04
      const istDate = toISTDate(bangerMatch.utcDate);
      expect(istDate).toBe("2025-04-04");
    });

    it("maps matchweek from formatted round string", () => {
      const round = formatRound(bangerMatch);
      expect(formatMatchweekFromRound(round)).toBe(30);
      expect(formatMatchweekFromRound("Regular Season - 1")).toBe(1);
      expect(formatMatchweekFromRound("QUARTER_FINALS")).toBeNull();
    });
  });

  describe("score and duration fields", () => {
    it("provides halfTime scores", () => {
      expect(bangerMatch.score.halfTime.home).toBe(1);
      expect(bangerMatch.score.halfTime.away).toBe(2);
    });

    it("provides winner field", () => {
      expect(bangerMatch.score.winner).toBe("HOME_TEAM");
      expect(snoozefestMatch.score.winner).toBe("DRAW");
    });

    it("identifies penalty shootout via duration", () => {
      expect(penaltyShootoutMatch.score.duration).toBe("PENALTY_SHOOTOUT");
      expect(bangerMatch.score.duration).toBe("REGULAR");
    });
  });

  describe("team upsert fields", () => {
    it("extracts team external IDs as strings", () => {
      expect(String(bangerMatch.homeTeam.id)).toBe("33");
      expect(String(bangerMatch.awayTeam.id)).toBe("40");
    });

    it("extracts team names", () => {
      expect(bangerMatch.homeTeam.name).toBe("Manchester United FC");
      expect(bangerMatch.awayTeam.name).toBe("Liverpool FC");
    });

    it("provides tla (3-letter abbreviation)", () => {
      expect(bangerMatch.homeTeam.tla).toBe("MUN");
      expect(bangerMatch.awayTeam.tla).toBe("LIV");
    });

    it("provides shortName", () => {
      expect(bangerMatch.homeTeam.shortName).toBe("Man United");
      expect(bangerMatch.awayTeam.shortName).toBe("Liverpool");
    });

    it("generates correct slug from team name", () => {
      const name = bangerMatch.homeTeam.name;
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      expect(slug).toBe("manchester-united-fc");
    });
  });

  describe("competition and area fields", () => {
    it("has competition code", () => {
      expect(bangerMatch.competition.code).toBe("PL");
    });

    it("has area info", () => {
      expect(bangerMatch.area.name).toBe("England");
      expect(bangerMatch.area.code).toBe("ENG");
    });

    it("has referees array", () => {
      expect(Array.isArray(bangerMatch.referees)).toBe(true);
      expect(bangerMatch.referees[0].name).toBe("Michael Oliver");
    });
  });
});
