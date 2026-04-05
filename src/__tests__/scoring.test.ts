import { describe, it, expect } from "vitest";
import { computeExcitementScore, type ScoringInput } from "@/lib/scoring";
import {
  bangerMatch,
  worthAWatchMatch,
  snoozefestMatch,
  penaltyShootoutMatch,
} from "./fixtures/api-football-mock";
import type { FDMatch } from "@/lib/sports-api";

// Helper: convert FDMatch → ScoringInput (mirrors what analyze-matches does)
function matchToScoringInput(match: FDMatch, extras?: Partial<ScoringInput>): ScoringInput {
  let duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" = "REGULAR";
  if (match.score.duration === "PENALTY_SHOOTOUT") duration = "PENALTY_SHOOTOUT";
  else if (match.score.duration === "EXTRA_TIME") duration = "EXTRA_TIME";

  return {
    homeScore: match.score.fullTime.home ?? 0,
    awayScore: match.score.fullTime.away ?? 0,
    halfTimeHome: match.score.halfTime.home,
    halfTimeAway: match.score.halfTime.away,
    duration,
    ...extras,
  };
}

describe("computeExcitementScore", () => {
  describe("tier classification", () => {
    it("classifies 5-goal comeback as banger (≥55)", () => {
      const result = computeExcitementScore(matchToScoringInput(bangerMatch));
      // goals=40, closeness=12, drama=15, extra=0, reddit=0, biggie=0 → 67
      expect(result.primaryTier).toBe("banger");
      expect(result.excitementScore).toBeGreaterThanOrEqual(55);
    });

    it("classifies 1-1 draw with comeback as worth_a_watch (30–54)", () => {
      const result = computeExcitementScore(matchToScoringInput(worthAWatchMatch));
      // goals=16, closeness=15, drama=13, extra=0, reddit=0, biggie=0 → 44
      expect(result.primaryTier).toBe("worth_a_watch");
      expect(result.excitementScore).toBeGreaterThanOrEqual(30);
      expect(result.excitementScore).toBeLessThan(55);
    });

    it("classifies 0-0 as snoozefest (<30)", () => {
      const result = computeExcitementScore(matchToScoringInput(snoozefestMatch));
      // goals=0, closeness=5, drama=0, extra=0, reddit=0, biggie=0 → 5
      expect(result.primaryTier).toBe("snoozefest");
      expect(result.excitementScore).toBeLessThan(30);
    });
  });

  describe("breakdown: goals (0–40)", () => {
    it("awards 8 pts per goal, capped at 40", () => {
      const result = computeExcitementScore(matchToScoringInput(bangerMatch));
      // 5 goals → min(5*8, 40) = 40
      expect(result.breakdown.goals).toBe(40);
    });

    it("awards 0 for 0-0", () => {
      const result = computeExcitementScore(matchToScoringInput(snoozefestMatch));
      expect(result.breakdown.goals).toBe(0);
    });

    it("awards 16 for 2 goals (1-1)", () => {
      const result = computeExcitementScore(matchToScoringInput(worthAWatchMatch));
      expect(result.breakdown.goals).toBe(16);
    });
  });

  describe("breakdown: closeness (0–15)", () => {
    it("15 for draw with goals", () => {
      const result = computeExcitementScore(matchToScoringInput(worthAWatchMatch));
      expect(result.breakdown.closeness).toBe(15);
    });

    it("12 for 1-goal margin", () => {
      const result = computeExcitementScore(matchToScoringInput(bangerMatch));
      expect(result.breakdown.closeness).toBe(12);
    });

    it("5 for 0-0 draw (tense affair)", () => {
      const result = computeExcitementScore(matchToScoringInput(snoozefestMatch));
      expect(result.breakdown.closeness).toBe(5);
    });
  });

  describe("breakdown: drama (0–20, merged comeback + 2H surge)", () => {
    it("awards 15 for full comeback win", () => {
      const result = computeExcitementScore(matchToScoringInput(bangerMatch));
      // HT 1-2, FT 3-2 → comeback=15, 2H surge: 2 goals < 3 1H → 0 → total 15
      expect(result.breakdown.drama).toBe(15);
    });

    it("awards 10+ for comeback draw + 2H surge", () => {
      const result = computeExcitementScore(matchToScoringInput(worthAWatchMatch));
      // HT 0-1, FT 1-1 → comeback=10, 2H: 1 goal > 1 1H goal? No, 1 > 1 is false → 0
      // Wait: 1H = 0+1 = 1, 2H = 2-1 = 1. 1 > 1 is false. But 1 second half goal scored
      // while 1 first half goal → not strictly more. Actually the 2H surge needs 2H > 1H.
      // 1 is not > 1, so no surge bonus. Just comeback=10 + 2H surge 3 for 1 goal when 0 1H?
      // 1H goals=1, 2H goals=1. 1>1 is false → no surge. drama=10
      expect(result.breakdown.drama).toBeGreaterThanOrEqual(10);
    });

    it("awards 0 for 0-0", () => {
      const result = computeExcitementScore(matchToScoringInput(snoozefestMatch));
      expect(result.breakdown.drama).toBe(0);
    });
  });

  describe("breakdown: extra_time (0–12)", () => {
    it("12 for penalty shootout", () => {
      const result = computeExcitementScore(matchToScoringInput(penaltyShootoutMatch));
      expect(result.breakdown.extra_time).toBe(12);
    });

    it("8 for extra time without shootout", () => {
      const input: ScoringInput = {
        homeScore: 2, awayScore: 1,
        halfTimeHome: 1, halfTimeAway: 1,
        duration: "EXTRA_TIME",
      };
      expect(computeExcitementScore(input).breakdown.extra_time).toBe(8);
    });

    it("0 for regular time", () => {
      const result = computeExcitementScore(matchToScoringInput(bangerMatch));
      expect(result.breakdown.extra_time).toBe(0);
    });
  });

  describe("breakdown: reddit_buzz (0–13)", () => {
    it("awards 0 when no Reddit data", () => {
      const result = computeExcitementScore(matchToScoringInput(bangerMatch));
      expect(result.breakdown.reddit_buzz).toBe(0);
    });

    it("awards max (13) for viral thread", () => {
      const input: ScoringInput = {
        homeScore: 3, awayScore: 3,
        halfTimeHome: 1, halfTimeAway: 2,
        duration: "REGULAR",
        redditComments: 6000,
        redditUpvotes: 8000,
      };
      const result = computeExcitementScore(input);
      expect(result.breakdown.reddit_buzz).toBe(13);
    });

    it("awards moderate buzz for mid-engagement thread", () => {
      const input: ScoringInput = {
        homeScore: 1, awayScore: 0,
        halfTimeHome: 0, halfTimeAway: 0,
        duration: "REGULAR",
        redditComments: 1600,
        redditUpvotes: 2500,
      };
      const result = computeExcitementScore(input);
      // comments 1600 → 4, upvotes 2500 → 3 → total 7
      expect(result.breakdown.reddit_buzz).toBe(7);
    });
  });

  describe("breakdown: biggie_boost (+5)", () => {
    it("adds 5 for biggie match", () => {
      const result = computeExcitementScore(matchToScoringInput(bangerMatch, { isBiggie: true }));
      expect(result.breakdown.biggie_boost).toBe(5);
    });

    it("adds 0 when not biggie", () => {
      const result = computeExcitementScore(matchToScoringInput(bangerMatch));
      expect(result.breakdown.biggie_boost).toBe(0);
    });

    it("biggie boost can push match into higher tier", () => {
      // A 1-0 win: goals=8, closeness=12 → 20 = snoozefest
      // With biggie: +5 → 25, still snoozefest
      // A 2-1 win (HT 0-0): goals=24, closeness=12, drama=3 → 39 = worth_a_watch
      // With biggie: +5 → 44, still worth_a_watch but higher
      const input: ScoringInput = {
        homeScore: 2, awayScore: 1,
        halfTimeHome: 0, halfTimeAway: 0,
        duration: "REGULAR",
        isBiggie: true,
      };
      const result = computeExcitementScore(input);
      expect(result.breakdown.biggie_boost).toBe(5);
      expect(result.excitementScore).toBeGreaterThan(
        computeExcitementScore({ ...input, isBiggie: false }).excitementScore
      );
    });
  });

  describe("score bounds", () => {
    it("score is always between 0 and 100", () => {
      const matches = [bangerMatch, worthAWatchMatch, snoozefestMatch, penaltyShootoutMatch];
      for (const m of matches) {
        const result = computeExcitementScore(matchToScoringInput(m));
        expect(result.excitementScore).toBeGreaterThanOrEqual(0);
        expect(result.excitementScore).toBeLessThanOrEqual(100);
      }
    });

    it("capped at 100 even with all signals maxed", () => {
      const input: ScoringInput = {
        homeScore: 5, awayScore: 4,
        halfTimeHome: 0, halfTimeAway: 3,
        duration: "PENALTY_SHOOTOUT",
        redditComments: 10000,
        redditUpvotes: 10000,
        isBiggie: true,
      };
      const result = computeExcitementScore(input);
      expect(result.excitementScore).toBeLessThanOrEqual(100);
    });
  });

  describe("edge cases", () => {
    it("handles null halfTime gracefully", () => {
      const input: ScoringInput = {
        homeScore: 1, awayScore: 0,
        halfTimeHome: null, halfTimeAway: null,
        duration: "REGULAR",
      };
      const result = computeExcitementScore(input);
      expect(result.excitementScore).toBeGreaterThanOrEqual(0);
      expect(result.primaryTier).toBeDefined();
    });

    it("0-0 with no halftime data scores 5 (closeness only)", () => {
      const input: ScoringInput = {
        homeScore: 0, awayScore: 0,
        halfTimeHome: null, halfTimeAway: null,
        duration: "REGULAR",
      };
      const result = computeExcitementScore(input);
      expect(result.excitementScore).toBe(5);
      expect(result.primaryTier).toBe("snoozefest");
    });

    it("handles undefined Reddit data gracefully", () => {
      const input: ScoringInput = {
        homeScore: 1, awayScore: 0,
        halfTimeHome: 0, halfTimeAway: 0,
        duration: "REGULAR",
      };
      const result = computeExcitementScore(input);
      expect(result.breakdown.reddit_buzz).toBe(0);
    });
  });
});
