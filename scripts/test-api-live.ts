/**
 * Live football-data.org integration test.
 * Hits the real v4 API, validates response shape, scores, teams, scoring.
 *
 * Usage: npx tsx scripts/test-api-live.ts
 *
 * Reads .env.local for FOOTBALL_DATA_TOKEN.
 * Uses ~2 API calls (free tier: 10 calls/minute).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { computeExcitementScore, type ScoringInput } from "../src/lib/scoring";

const TOKEN = process.env.FOOTBALL_DATA_TOKEN || "";
const BASE_URL = "https://api.football-data.org/v4";

// ── Helpers ──

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function pass(msg: string) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function fail(msg: string, detail?: string) {
  console.log(`  ${RED}✗${RESET} ${msg}`);
  if (detail) console.log(`    ${DIM}${detail}${RESET}`);
}
function warn(msg: string) { console.log(`  ${YELLOW}⚠${RESET} ${msg}`); }
function heading(msg: string) { console.log(`\n${BOLD}${CYAN}${msg}${RESET}`); }

async function apiFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "X-Auth-Token": TOKEN },
  });

  return { status: res.status, ok: res.ok, json: await res.json(), headers: res.headers };
}

// ── Tests ──

let passed_count = 0;
let failed_count = 0;
let warnings_count = 0;

function check(condition: boolean, passMsg: string, failMsg: string, detail?: string) {
  if (condition) { pass(passMsg); passed_count++; }
  else { fail(failMsg, detail); failed_count++; }
}

async function run() {
  console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  football-data.org Live Integration Test${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${DIM}  Base: ${BASE_URL}${RESET}`);
  console.log(`${DIM}  Token: ${TOKEN.slice(0, 6)}...${TOKEN.slice(-4)}${RESET}`);

  // ── 1. Auth & connectivity ──
  heading("1. Auth & Connectivity");

  if (!TOKEN) {
    fail("FOOTBALL_DATA_TOKEN is not set in .env.local");
    process.exit(1);
  }
  pass("FOOTBALL_DATA_TOKEN is configured");

  const { status, ok, json: compsJson } = await apiFetch("/competitions");
  check(ok, `API reachable (HTTP ${status})`, `API returned HTTP ${status}`);

  if (compsJson.competitions) {
    const free = compsJson.competitions.filter((c: any) => c.plan === "TIER_ONE");
    pass(`${free.length} free-tier competitions available`);
    const hasPL = free.some((c: any) => c.code === "PL");
    check(hasPL, "Premier League (PL) is available", "Premier League not found in free tier");
  }

  // ── 2. Fetch recent PL finished matches ──
  heading("2. Fetch PL Finished Matches (last 30 days)");

  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const dateFrom = monthAgo.toISOString().split("T")[0];
  const dateTo = today.toISOString().split("T")[0];

  const { ok: matchesOk, json: matchesJson } = await apiFetch("/competitions/PL/matches", {
    dateFrom,
    dateTo,
    status: "FINISHED",
  });

  check(matchesOk, "Matches endpoint responded OK", "Matches endpoint failed");

  const matches = matchesJson.matches || [];
  check(matches.length > 0, `Found ${matches.length} finished PL match(es) in ${dateFrom} to ${dateTo}`, "No finished matches found in last 30 days");

  if (matches.length === 0) {
    printSummary();
    return;
  }

  // Pick a match with goals for richer testing
  const goalMatch = matches.find((m: any) =>
    (m.score?.fullTime?.home ?? 0) > 0 || (m.score?.fullTime?.away ?? 0) > 0
  ) || matches[0];

  // ── 3. Validate match structure ──
  heading("3. Validate Match Structure");

  const m = goalMatch;
  const label = `${m.homeTeam?.shortName || "?"} ${m.score?.fullTime?.home ?? "?"}-${m.score?.fullTime?.away ?? "?"} ${m.awayTeam?.shortName || "?"}`;
  console.log(`${DIM}  Inspecting: ${label} (ID: ${m.id})${RESET}`);

  // Top-level fields
  check(typeof m.id === "number", `id is number (${m.id})`, "id missing or not number");
  check(typeof m.utcDate === "string", `utcDate = "${m.utcDate}"`, "utcDate missing");
  check(m.status === "FINISHED", `status = "FINISHED"`, `Unexpected status: "${m.status}"`);
  check(typeof m.matchday === "number", `matchday = ${m.matchday}`, "matchday missing");
  check(typeof m.stage === "string", `stage = "${m.stage}"`, "stage missing");

  // Competition
  check(!!m.competition, "competition object exists", "competition missing");
  check(m.competition?.code === "PL", `competition.code = "PL"`, `Unexpected: ${m.competition?.code}`);

  // Season
  check(!!m.season, "season object exists", "season missing");
  check(typeof m.season?.startDate === "string", `season.startDate = "${m.season?.startDate}"`, "season.startDate missing");

  // Teams
  check(!!m.homeTeam, "homeTeam exists", "homeTeam missing");
  check(!!m.awayTeam, "awayTeam exists", "awayTeam missing");
  check(typeof m.homeTeam?.id === "number", `homeTeam.id = ${m.homeTeam?.id}`, "homeTeam.id missing");
  check(typeof m.awayTeam?.id === "number", `awayTeam.id = ${m.awayTeam?.id}`, "awayTeam.id missing");
  check(typeof m.homeTeam?.name === "string", `homeTeam.name = "${m.homeTeam?.name}"`, "homeTeam.name missing");
  check(typeof m.homeTeam?.shortName === "string", `homeTeam.shortName = "${m.homeTeam?.shortName}"`, "homeTeam.shortName missing");
  check(typeof m.homeTeam?.tla === "string", `homeTeam.tla = "${m.homeTeam?.tla}"`, "homeTeam.tla missing");

  // Score
  check(!!m.score, "score object exists", "score missing");
  check(!!m.score?.fullTime, "score.fullTime exists", "score.fullTime missing");
  check(!!m.score?.halfTime, "score.halfTime exists", "score.halfTime missing");
  check(typeof m.score?.fullTime?.home === "number", `fullTime.home = ${m.score?.fullTime?.home}`, "fullTime.home not number");
  check(typeof m.score?.fullTime?.away === "number", `fullTime.away = ${m.score?.fullTime?.away}`, "fullTime.away not number");
  check(typeof m.score?.halfTime?.home === "number", `halfTime.home = ${m.score?.halfTime?.home}`, "halfTime.home not number");
  check(typeof m.score?.halfTime?.away === "number", `halfTime.away = ${m.score?.halfTime?.away}`, "halfTime.away not number");
  check(typeof m.score?.winner === "string", `winner = "${m.score?.winner}"`, "winner missing");
  check(typeof m.score?.duration === "string", `duration = "${m.score?.duration}"`, "duration missing");

  // Referees
  check(Array.isArray(m.referees), `referees is array (${m.referees?.length || 0} entries)`, "referees not array");

  // ── 4. Validate mapStatus logic ──
  heading("4. Validate Status Mapping");

  function mapStatus(match: any): string {
    if (match.status !== "FINISHED") return match.status;
    if (match.score?.duration === "PENALTY_SHOOTOUT") return "PEN";
    if (match.score?.duration === "EXTRA_TIME") return "AET";
    return "FT";
  }

  const mappedStatus = mapStatus(m);
  check(
    ["FT", "AET", "PEN"].includes(mappedStatus),
    `Mapped status: "${mappedStatus}"`,
    `Invalid mapped status: "${mappedStatus}"`,
  );

  // ── 5. Test excitement scoring ──
  heading("5. Test Excitement Scoring");

  const ftHome = m.score?.fullTime?.home ?? 0;
  const ftAway = m.score?.fullTime?.away ?? 0;
  const htHome = m.score?.halfTime?.home ?? null;
  const htAway = m.score?.halfTime?.away ?? null;

  let duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" = "REGULAR";
  if (m.score?.duration === "PENALTY_SHOOTOUT") duration = "PENALTY_SHOOTOUT";
  else if (m.score?.duration === "EXTRA_TIME") duration = "EXTRA_TIME";

  const scoringInput: ScoringInput = {
    homeScore: ftHome,
    awayScore: ftAway,
    halfTimeHome: htHome,
    halfTimeAway: htAway,
    duration,
  };

  const scoring = computeExcitementScore(scoringInput);

  check(
    scoring.excitementScore >= 0 && scoring.excitementScore <= 100,
    `Excitement score: ${scoring.excitementScore}/100`,
    `Score out of range: ${scoring.excitementScore}`,
  );
  check(
    ["banger", "worth_a_watch", "snoozefest"].includes(scoring.primaryTier),
    `Tier: ${scoring.primaryTier}`,
    `Invalid tier: ${scoring.primaryTier}`,
  );

  console.log(`\n  ${DIM}Breakdown:${RESET}`);
  for (const [key, val] of Object.entries(scoring.breakdown)) {
    console.log(`    ${key}: ${val}`);
  }

  // ── 6. Batch scoring — all matches with full breakdown ──
  heading("6. Score All Matches (new algorithm)");

  type ScoredMatch = { label: string; score: number; tier: string; breakdown: Record<string, number> };
  const scored: ScoredMatch[] = [];

  for (const match of matches) {
    const ft = match.score?.fullTime || { home: 0, away: 0 };
    const ht = match.score?.halfTime || { home: 0, away: 0 };

    let dur: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" = "REGULAR";
    if (match.score?.duration === "PENALTY_SHOOTOUT") dur = "PENALTY_SHOOTOUT";
    else if (match.score?.duration === "EXTRA_TIME") dur = "EXTRA_TIME";

    const result = computeExcitementScore({
      homeScore: ft.home ?? 0,
      awayScore: ft.away ?? 0,
      halfTimeHome: ht.home,
      halfTimeAway: ht.away,
      duration: dur,
    });

    scored.push({
      label: `${match.homeTeam?.shortName} ${ft.home}-${ft.away} ${match.awayTeam?.shortName} (HT: ${ht.home}-${ht.away})`,
      score: result.excitementScore,
      tier: result.primaryTier,
      breakdown: result.breakdown,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const tiers: Record<string, number> = { banger: 0, worth_a_watch: 0, snoozefest: 0 };
  for (const s of scored) tiers[s.tier]++;

  pass(`Scored ${scored.length} matches: ${tiers.banger} bangers, ${tiers.worth_a_watch} worth-a-watch, ${tiers.snoozefest} snoozefests`);
  pass(`Highest: ${scored[0].label} (${scored[0].score}/100)`);

  check(
    tiers.banger + tiers.worth_a_watch + tiers.snoozefest === matches.length,
    "All matches classified into a tier",
    "Some matches not classified",
  );

  // ── 7. Print all matches ranked ──
  heading("7. All Matches Ranked");

  for (const s of scored) {
    const icon = s.tier === "banger" ? "🔥" : s.tier === "worth_a_watch" ? "👀" : "😴";
    const bk = Object.entries(s.breakdown)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(`  ${icon} ${String(s.score).padStart(3)}/100  ${s.label}  ${DIM}${bk}${RESET}`);
  }

  printSummary();
}

function printSummary() {
  console.log(`\n${BOLD}═══════════════════════════════════════════════════${RESET}`);
  console.log(`  ${GREEN}${passed_count} passed${RESET}  ${failed_count > 0 ? `${RED}${failed_count} failed${RESET}  ` : ""}${warnings_count > 0 ? `${YELLOW}${warnings_count} warnings${RESET}` : ""}`);
  if (failed_count === 0) {
    console.log(`\n  ${GREEN}${BOLD}All checks passed! API data is flowing correctly.${RESET}`);
  } else {
    console.log(`\n  ${RED}${BOLD}Some checks failed — review above.${RESET}`);
  }
  console.log(`${BOLD}═══════════════════════════════════════════════════${RESET}\n`);
}

run().catch((err) => {
  console.error(`\n${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});
