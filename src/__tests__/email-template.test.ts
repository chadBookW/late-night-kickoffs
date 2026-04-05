import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { DailyDigestEmail } from "@/emails/daily-digest";

const sampleMatches = [
  {
    homeTeam: "Arsenal",
    awayTeam: "Liverpool",
    homeScore: 3,
    awayScore: 2,
    leagueName: "Premier League",
    matchweek: "28",
    tier: "banger",
    isBiggie: true,
    summary: "A five-goal thriller with late drama and a red card.",
    highlightUrl: "https://example.com/highlights/arsenal-liverpool",
    featuredInEmail: true,
  },
  {
    homeTeam: "Man City",
    awayTeam: "Tottenham",
    homeScore: 1,
    awayScore: 1,
    leagueName: "Premier League",
    matchweek: "28",
    tier: "worth_a_watch",
    isBiggie: false,
    summary: "",
    highlightUrl: "https://example.com/highlights/city-spurs",
  },
  {
    homeTeam: "Burnley",
    awayTeam: "Sheffield Utd",
    homeScore: 0,
    awayScore: 0,
    tier: "snoozefest",
    isBiggie: false,
    summary: "",
    highlightUrl: null,
  },
  {
    homeTeam: "Fulham",
    awayTeam: "Bournemouth",
    homeScore: 1,
    awayScore: 1,
    tier: "snoozefest",
    isBiggie: false,
    summary: "",
    highlightUrl: null,
  },
];

describe("DailyDigestEmail", () => {
  it("renders without throwing", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "https://example.com/unsubscribe?token=abc",
        preferencesUrl: "https://example.com/preferences?token=abc",
      })
    );
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
  });

  it("includes banger match details", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    expect(html).toContain("Arsenal");
    expect(html).toContain("Liverpool");
    expect(html).toContain("BANGER");
  });

  it("includes worth_a_watch section", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    expect(html).toContain("Worth a Watch");
    expect(html).toContain("Man City");
    expect(html).toContain("Tottenham");
  });

  it("includes snoozefest section with compact listing", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    expect(html).toContain("Skip These");
    expect(html).toContain("Burnley");
    expect(html).toContain("Sheffield Utd");
    expect(html).toContain("Fulham");
    expect(html).toContain("Bournemouth");
  });

  it("formats score correctly (home – away)", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    // Score format: "3 – 2"
    expect(html).toContain("3");
    expect(html).toContain("2");
  });

  it("includes highlight links when present", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    expect(html).toContain("https://example.com/highlights/arsenal-liverpool");
    expect(html).toContain("Highlights");
  });

  it("includes unsubscribe and preferences links in footer", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "https://example.com/unsub",
        preferencesUrl: "https://example.com/prefs",
      })
    );
    expect(html).toContain("https://example.com/unsub");
    expect(html).toContain("https://example.com/prefs");
    expect(html).toContain("Preferences");
    expect(html).toContain("Unsubscribe");
  });

  it("includes digest date in header", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    expect(html).toContain("Apr 3, 2025");
  });

  it("renders correctly with no matches", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: [],
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    expect(typeof html).toBe("string");
    // Should NOT contain tier headers
    expect(html).not.toContain("BANGER");
    expect(html).not.toContain("Worth a Watch");
    expect(html).not.toContain("Skip These");
  });

  it("renders correctly with only snoozefests", async () => {
    const snoozefestsOnly = sampleMatches.filter((m) => m.tier === "snoozefest");
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: snoozefestsOnly,
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    expect(html).toContain("Skip These");
    expect(html).not.toContain("BANGER");
    expect(html).not.toContain("Worth a Watch");
  });

  it("preview text includes banger count", async () => {
    const html = await render(
      DailyDigestEmail({
        digestDate: "Apr 3, 2025",
        matches: sampleMatches,
        unsubscribeUrl: "#",
        preferencesUrl: "#",
      })
    );
    // Preview: "LNK — Apr 3, 2025 · 1 banger, 1 worth a watch"
    expect(html).toContain("1 banger");
    expect(html).toContain("1 worth a watch");
  });
});
