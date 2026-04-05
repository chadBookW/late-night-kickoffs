import { describe, it, expect } from "vitest";
import { containsSpoiler, findSpoilerWords, getFallbackSummary } from "@/lib/spoiler-check";

describe("containsSpoiler", () => {
  it("detects 'won' but not 'won't'", () => {
    expect(containsSpoiler("Arsenal won the match")).toBe(true);
    expect(containsSpoiler("You won't believe this match")).toBe(false);
  });

  it("detects 'beat'", () => {
    expect(containsSpoiler("Liverpool beat Chelsea")).toBe(true);
  });

  it("detects 'defeated'", () => {
    expect(containsSpoiler("City defeated United in a thrilling encounter")).toBe(true);
  });

  it("detects 'comeback'", () => {
    expect(containsSpoiler("A stunning comeback from the visitors")).toBe(true);
  });

  it("detects 'victory'", () => {
    expect(containsSpoiler("A sweet victory for the hosts")).toBe(true);
  });

  it("detects 'thrashed'", () => {
    expect(containsSpoiler("Spurs thrashed Leicester")).toBe(true);
  });

  it("detects 'bottled'", () => {
    expect(containsSpoiler("They bottled a two-goal lead")).toBe(true);
  });

  it("detects 'edge' as standalone word", () => {
    expect(containsSpoiler("They edge closer to the title")).toBe(true);
  });

  it("detects scoreline patterns like '3-2'", () => {
    expect(containsSpoiler("The match ended 3-2")).toBe(true);
    expect(containsSpoiler("A dramatic 2 – 1 affair")).toBe(true);
  });

  it("detects exact goal counts", () => {
    expect(containsSpoiler("There were 5 goals in this match")).toBe(true);
    expect(containsSpoiler("Five goals were scored")).toBe(true);
    expect(containsSpoiler("scored 3 in the second half")).toBe(true);
  });

  it("detects 'goalless' and 'nil-nil'", () => {
    expect(containsSpoiler("A goalless draw at the Emirates")).toBe(true);
    expect(containsSpoiler("It finished nil-nil")).toBe(true);
    expect(containsSpoiler("A scoreless affair")).toBe(true);
  });

  it("detects 'clean sheet' and 'hat-trick'", () => {
    expect(containsSpoiler("The keeper kept a clean sheet")).toBe(true);
    expect(containsSpoiler("He completed his hat-trick")).toBe(true);
  });

  it("does NOT flag safe spoiler-free teasers", () => {
    expect(containsSpoiler("Drama, chaos, and moments you have to see")).toBe(false);
  });

  it("does NOT flag neutral language without scores", () => {
    expect(
      containsSpoiler(
        "An end-to-end affair with plenty of drama and a late sending-off"
      )
    ).toBe(false);
  });

  it("does NOT flag fallback templates", () => {
    expect(
      containsSpoiler("Buckle up — this one had everything. Drama, chaos, and moments you have to see.")
    ).toBe(false);
  });

  it("is case insensitive", () => {
    expect(containsSpoiler("Arsenal WON the match")).toBe(true);
    expect(containsSpoiler("DEFEATED in the final")).toBe(true);
  });
});

describe("findSpoilerWords", () => {
  it("returns all spoiler words found", () => {
    const words = findSpoilerWords("Arsenal won and beat Liverpool in a victory");
    expect(words).toContain("won");
    expect(words).toContain("beat");
    expect(words).toContain("victory");
  });

  it("returns empty array for clean text", () => {
    expect(findSpoilerWords("A tight contest with plenty of drama")).toHaveLength(0);
  });
});

describe("getFallbackSummary", () => {
  const tiers = ["banger", "worth_a_watch", "snoozefest"] as const;

  for (const tier of tiers) {
    it(`returns a non-empty string for tier: ${tier}`, () => {
      const summary = getFallbackSummary(tier);
      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(10);
    });

    it(`fallback for ${tier} passes spoiler check`, () => {
      // Run multiple times since it's random
      for (let i = 0; i < 10; i++) {
        const summary = getFallbackSummary(tier);
        expect(containsSpoiler(summary)).toBe(false);
      }
    });
  }
});
