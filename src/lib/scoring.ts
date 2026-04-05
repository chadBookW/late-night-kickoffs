export type ScoringInput = {
  homeScore: number;
  awayScore: number;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  /** Reddit engagement from r/soccer post-match thread */
  redditComments?: number | null;
  redditUpvotes?: number | null;
  /** Whether this is a biggie (derby, big-team clash, late season) */
  isBiggie?: boolean;
};

export type ScoringResult = {
  excitementScore: number;
  primaryTier: "banger" | "worth_a_watch" | "snoozefest";
  breakdown: Record<string, number>;
};

/**
 * Compute excitement score from match scores + Reddit engagement.
 *
 * Scoring factors:
 *   - Goal activity (0–40): total goals scored (smoother curve)
 *   - Closeness (0–15): margin of victory / draw
 *   - Comeback & drama (0–20): HT comeback + 2nd-half goal surge (merged)
 *   - Extra time / penalties (0–12): match went beyond 90 mins
 *   - Reddit buzz (0–13): community engagement from r/soccer
 *
 * Max base = 100. Biggie boost adds +5 (capped at 100).
 * Thresholds: ≥55 banger, ≥30 worth_a_watch, else snoozefest.
 */
export function computeExcitementScore(input: ScoringInput): ScoringResult {
  const breakdown: Record<string, number> = {};
  const home = input.homeScore ?? 0;
  const away = input.awayScore ?? 0;
  const totalGoals = home + away;

  // ── Goal activity (0–40) ──
  // Smoother curve: min(totalGoals * 8, 40) — each goal = 8 pts, cap at 5+
  breakdown.goals = Math.min(totalGoals * 8, 40);

  // ── Closeness (0–15) ──
  const scoreDiff = Math.abs(home - away);
  if (scoreDiff === 0 && totalGoals > 0) {
    breakdown.closeness = 15;           // draw with goals
  } else if (scoreDiff === 0 && totalGoals === 0) {
    breakdown.closeness = 5;            // 0-0 is still a tense affair
  } else if (scoreDiff === 1) {
    breakdown.closeness = 12;           // one-goal margin
  } else if (scoreDiff === 2 && totalGoals >= 4) {
    breakdown.closeness = 6;            // high-scoring but lopsided-ish
  } else {
    breakdown.closeness = 0;
  }

  // ── Comeback & drama (0–20, merged) ──
  // Combines: HT comeback detection + 2nd-half goal surge
  const htHome = input.halfTimeHome ?? 0;
  const htAway = input.halfTimeAway ?? 0;
  let dramaScore = 0;

  // Comeback: team trailing at HT draws or wins
  if (htHome !== htAway) {
    const htLeader = htHome > htAway ? "home" : "away";
    const ftLeader = home > away ? "home" : away > home ? "away" : "draw";

    if (ftLeader === "draw") {
      dramaScore += 10;                 // came back to draw
    } else if (ftLeader !== htLeader) {
      dramaScore += 15;                 // full comeback win
    }
  }

  // Second-half surge: more goals in 2H than 1H
  const firstHalfGoals = htHome + htAway;
  const secondHalfGoals = totalGoals - firstHalfGoals;
  if (secondHalfGoals > firstHalfGoals && secondHalfGoals >= 2) {
    dramaScore += 5;
  } else if (secondHalfGoals > firstHalfGoals && secondHalfGoals >= 1) {
    dramaScore += 3;
  }

  breakdown.drama = Math.min(dramaScore, 20);

  // ── Extra time / Penalty shootout (0–12) ──
  let extraTimeScore = 0;
  if (input.duration === "PENALTY_SHOOTOUT") {
    extraTimeScore = 12;
  } else if (input.duration === "EXTRA_TIME") {
    extraTimeScore = 8;
  }
  breakdown.extra_time = extraTimeScore;

  // ── Reddit buzz (0–13) ──
  // Based on r/soccer post-match thread engagement
  const comments = input.redditComments ?? 0;
  const upvotes = input.redditUpvotes ?? 0;
  let buzzScore = 0;

  if (comments > 0 || upvotes > 0) {
    // Comment-based (0–8): logarithmic scale
    if (comments >= 5000) buzzScore += 8;
    else if (comments >= 3000) buzzScore += 6;
    else if (comments >= 1500) buzzScore += 4;
    else if (comments >= 500) buzzScore += 2;

    // Upvote-based (0–5): measures broad interest
    if (upvotes >= 5000) buzzScore += 5;
    else if (upvotes >= 2000) buzzScore += 3;
    else if (upvotes >= 500) buzzScore += 1;
  }
  breakdown.reddit_buzz = Math.min(buzzScore, 13);

  // ── Biggie boost (+5) ──
  breakdown.biggie_boost = input.isBiggie ? 5 : 0;

  // ── Total ──
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const excitementScore = Math.min(total, 100);

  // ── Tier ──
  let primaryTier: "banger" | "worth_a_watch" | "snoozefest";
  if (excitementScore >= 55) primaryTier = "banger";
  else if (excitementScore >= 30) primaryTier = "worth_a_watch";
  else primaryTier = "snoozefest";

  return { excitementScore, primaryTier, breakdown };
}
