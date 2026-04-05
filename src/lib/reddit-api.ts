/**
 * Reddit r/soccer API client for post-match thread engagement data.
 *
 * Uses Reddit's public JSON API (no auth needed for read-only).
 * Rate limit: ~10 req/min unauthenticated.
 */

const SUBREDDIT = "soccer";
const USER_AGENT = "football-digest/1.0";
const BASE_URL = "https://www.reddit.com";

export type RedditEngagement = {
  postId: string;
  title: string;
  comments: number;
  upvotes: number;
  upvoteRatio: number;
  permalink: string;
  createdUtc: number;
};

/**
 * Search r/soccer for a post-match thread matching the given teams.
 * Searches by team names within a date window.
 *
 * Returns null if no matching thread found.
 */
export async function findPostMatchThread(
  homeTeam: string,
  awayTeam: string,
  matchDateUtc: string,
): Promise<RedditEngagement | null> {
  // Build search queries — try multiple strategies
  const queries = buildSearchQueries(homeTeam, awayTeam);

  for (const query of queries) {
    const result = await searchReddit(query, matchDateUtc);
    if (result) return result;
  }

  return null;
}

/**
 * Batch-fetch Reddit engagement for multiple matches.
 * Respects rate limiting by adding delays between requests.
 */
export async function findPostMatchThreads(
  matches: Array<{
    homeTeam: string;
    awayTeam: string;
    matchDateUtc: string;
  }>,
): Promise<Map<string, RedditEngagement>> {
  const results = new Map<string, RedditEngagement>();

  for (const match of matches) {
    const key = `${match.homeTeam} vs ${match.awayTeam}`;
    try {
      const engagement = await findPostMatchThread(
        match.homeTeam,
        match.awayTeam,
        match.matchDateUtc,
      );
      if (engagement) {
        results.set(key, engagement);
      }
    } catch (err) {
      console.warn(`[reddit] Failed to fetch thread for ${key}:`, err);
    }

    // Rate limit: ~10 req/min unauthenticated → wait 7s between requests
    await sleep(7000);
  }

  return results;
}

// ── Internal helpers ──

function buildSearchQueries(homeTeam: string, awayTeam: string): string[] {
  // Strip common suffixes for better matching
  const home = stripTeamSuffix(homeTeam);
  const away = stripTeamSuffix(awayTeam);

  return [
    // Most specific: full thread title format
    `"Post Match Thread" "${home}" "${away}"`,
    // Reversed order (Reddit titles sometimes vary)
    `"Post Match Thread" "${away}" "${home}"`,
    // Shorter names (e.g., "Man United" instead of "Manchester United FC")
    `"Post Match" ${home} ${away}`,
  ];
}

function stripTeamSuffix(name: string): string {
  return name
    .replace(/\s+(FC|CF|SC|AC|AS|SS|US|SL|SK|FK|BK|IF|FF|CD|UD|RC|RCD|SD|CP|SCP|AFC|BSC|TSG|VfB|VfL|1\.\s*FC|1\.\s*FSV)$/i, "")
    .trim();
}

async function searchReddit(
  query: string,
  matchDateUtc: string,
): Promise<RedditEngagement | null> {
  const url = new URL(`${BASE_URL}/r/${SUBREDDIT}/search.json`);
  url.searchParams.set("q", `${query} flair:"Post Match Thread"`);
  url.searchParams.set("restrict_sr", "on");
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("t", "week");
  url.searchParams.set("limit", "5");

  let json: any;
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("[reddit] Rate limited, backing off");
        await sleep(10000);
      }
      return null;
    }

    json = await res.json();
  } catch {
    return null;
  }

  const posts = json?.data?.children || [];
  if (posts.length === 0) return null;

  // Find the best match: closest in time to the match date
  const matchTime = new Date(matchDateUtc).getTime() / 1000;

  const scored = posts
    .map((p: any) => {
      const d = p.data;
      // Post should be within 24 hours after match kickoff
      const timeDiff = d.created_utc - matchTime;
      const withinWindow = timeDiff >= -3600 && timeDiff <= 86400; // 1hr before to 24hr after
      return { data: d, timeDiff: Math.abs(timeDiff), withinWindow };
    })
    .filter((p: any) => p.withinWindow)
    .sort((a: any, b: any) => a.timeDiff - b.timeDiff);

  if (scored.length === 0) return null;

  const best = scored[0].data;
  return {
    postId: best.id,
    title: best.title,
    comments: best.num_comments || 0,
    upvotes: best.score || 0,
    upvoteRatio: best.upvote_ratio || 0,
    permalink: best.permalink,
    createdUtc: best.created_utc,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
