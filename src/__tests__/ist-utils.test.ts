import { describe, it, expect } from "vitest";
import { toISTDate, formatMatchweekFromRound, yesterdayIST, nowIST } from "@/lib/ist-utils";

describe("toISTDate", () => {
  it("converts UTC evening to next day IST", () => {
    // UTC 20:00 → IST 01:30 next day
    expect(toISTDate("2025-04-03T20:00:00+00:00")).toBe("2025-04-04");
  });

  it("converts UTC morning to same day IST", () => {
    // UTC 10:00 → IST 15:30 same day
    expect(toISTDate("2025-04-03T10:00:00+00:00")).toBe("2025-04-03");
  });

  it("handles midnight UTC → IST", () => {
    // UTC 00:00 → IST 05:30 same day
    expect(toISTDate("2025-04-03T00:00:00+00:00")).toBe("2025-04-03");
  });

  it("handles IST timezone offset in input", () => {
    // Already IST offset
    expect(toISTDate("2025-04-03T01:30:00+05:30")).toBe("2025-04-03");
  });

  it("handles year boundary", () => {
    // UTC 2024-12-31T20:00 → IST 2025-01-01T01:30
    expect(toISTDate("2024-12-31T20:00:00+00:00")).toBe("2025-01-01");
  });
});

describe("formatMatchweekFromRound", () => {
  it("extracts matchweek from 'Regular Season - 30'", () => {
    expect(formatMatchweekFromRound("Regular Season - 30")).toBe(30);
  });

  it("extracts matchweek from 'Regular Season - 1'", () => {
    expect(formatMatchweekFromRound("Regular Season - 1")).toBe(1);
  });

  it("extracts matchweek from 'Regular Season - 38'", () => {
    expect(formatMatchweekFromRound("Regular Season - 38")).toBe(38);
  });

  it("returns null for non-numeric round", () => {
    expect(formatMatchweekFromRound("Quarter-finals")).toBeNull();
    expect(formatMatchweekFromRound("Group A")).toBeNull();
  });

  it("extracts number from mixed round string", () => {
    expect(formatMatchweekFromRound("Round of 16")).toBe(16);
  });
});

describe("yesterdayIST", () => {
  it("returns dateStr in YYYY-MM-DD format", () => {
    const { dateStr } = yesterdayIST();
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns utcFrom and utcTo in YYYY-MM-DD format", () => {
    const { utcFrom, utcTo } = yesterdayIST();
    expect(utcFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(utcTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("nowIST", () => {
  it("returns a Date object", () => {
    const result = nowIST();
    expect(result instanceof Date).toBe(true);
  });

  it("is ahead of UTC by roughly 5.5 hours", () => {
    const utcNow = new Date();
    const istNow = nowIST();
    const diffMs = istNow.getTime() - utcNow.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    // Should be ~5.5 hours ahead (allow small tolerance for execution time)
    expect(diffHours).toBeGreaterThan(5.4);
    expect(diffHours).toBeLessThan(5.6);
  });
});
