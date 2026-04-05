/**
 * YouTube Data API v3 client for finding match highlight videos.
 *
 * Free tier: 10,000 units/day. Search costs 100 units = ~100 searches/day.
 * We search for "{homeTeam} vs {awayTeam} highlights" filtered to last 24-48h.
 *
 * Preferred channels (in order):
 *  - Official league channels (e.g. "Premier League", "Bundesliga")
 *  - Official team channels
 *  - Broadcasters (beIN Sports, BT Sport, Sony Sports Network)
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const BASE_URL = "https://www.googleapis.com/youtube/v3";

export type HighlightResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
};

// Known trusted channels for highlight content (channel IDs)
const TRUSTED_CHANNELS: Record<string, string> = {
  // Leagues
  "Premier League": "UCG5qGWdu8nIRZqJ_GgDwQ-w",
  "Bundesliga": "UCmyxyg7BGLaFEzCqgfJJBQg",
  "LaLiga": "UCTv-XvfzLX0WO4EvMoMg1DQ",
  "Ligue 1": "UCFcRgPayliGBaZeMWghSXlg",
  "Serie A": "UCBJsMCUzS7sxyV7pqJpwISg",
  // Broadcasters
  "beIN SPORTS": "UCHTh9z55F18sl4cjcz97olQ",
  "BT Sport": "UCGudTUnHbYJpuNIMpv6xWAg",
  "Sony Sports Network": "UCqKt3LXUsBGMQ49q4AUfHQg",
};

// Map competition codes to their official YouTube channel IDs
const LEAGUE_CHANNEL_MAP: Record<string, string[]> = {
  PL: [TRUSTED_CHANNELS["Premier League"]].filter(Boolean),
  BL1: [TRUSTED_CHANNELS["Bundesliga"]].filter(Boolean),
  CL: [], // No single official CL highlights channel (varies by broadcaster)
  PD: [TRUSTED_CHANNELS["LaLiga"]].filter(Boolean),
  FL1: [TRUSTED_CHANNELS["Ligue 1"]].filter(Boolean),
  SA: [TRUSTED_CHANNELS["Serie A"]].filter(Boolean),
};

type YouTubeSearchItem = {
  id: { kind: string; videoId: string };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    channelTitle: string;
  };
};

type YouTubeSearchResponse = {
  items: YouTubeSearchItem[];
  pageInfo: { totalResults: number; resultsPerPage: number };
};

/**
 * Search YouTube for highlight video of a specific match.
 * Tries league-specific channel first, then broad search.
 *
 * @returns Best matching highlight video, or null if not found.
 */
export async function findHighlightVideo(
  homeTeam: string,
  awayTeam: string,
  matchDateUtc: string,
  competitionCode?: string,
): Promise<HighlightResult | null> {
  if (!YOUTUBE_API_KEY) {
    console.warn("[youtube] No YOUTUBE_API_KEY set, skipping highlight search");
    return null;
  }

  const queries = buildSearchQueries(homeTeam, awayTeam);

  // Strategy 1: Search the league's official channel first
  if (competitionCode && LEAGUE_CHANNEL_MAP[competitionCode]?.length) {
    for (const channelId of LEAGUE_CHANNEL_MAP[competitionCode]) {
      for (const query of queries) {
        const result = await searchYouTube(query, matchDateUtc, channelId);
        if (result) return result;
      }
    }
  }

  // Strategy 2: Broad search (any channel), pick the best result
  for (const query of queries) {
    const result = await searchYouTube(query, matchDateUtc);
    if (result) return result;
  }

  return null;
}

/**
 * Batch-fetch highlight videos for multiple matches.
 * Adds a small delay between requests to stay within rate limits.
 */
export async function findHighlightVideos(
  matches: Array<{
    homeTeam: string;
    awayTeam: string;
    matchDateUtc: string;
    competitionCode?: string;
  }>,
): Promise<Map<string, HighlightResult>> {
  const results = new Map<string, HighlightResult>();

  for (const match of matches) {
    const key = `${match.homeTeam} vs ${match.awayTeam}`;
    try {
      const highlight = await findHighlightVideo(
        match.homeTeam,
        match.awayTeam,
        match.matchDateUtc,
        match.competitionCode,
      );
      if (highlight) {
        results.set(key, highlight);
        console.log(`[youtube] Found: ${highlight.title} (${highlight.channelTitle})`);
      } else {
        console.log(`[youtube] No highlights found for ${key}`);
      }
    } catch (err) {
      console.warn(`[youtube] Error searching for ${key}:`, err);
    }

    // Small delay to avoid hammering the API
    await sleep(500);
  }

  return results;
}

// ── Internal helpers ──

function buildSearchQueries(homeTeam: string, awayTeam: string): string[] {
  const home = stripTeamSuffix(homeTeam);
  const away = stripTeamSuffix(awayTeam);

  return [
    `${home} vs ${away} highlights`,
    `${home} ${away} highlights`,
  ];
}

function stripTeamSuffix(name: string): string {
  return name
    .replace(/\s+(FC|CF|SC|AC|AS|SS|US|SL|SK|FK|BK|IF|FF|CD|UD|RC|RCD|SD|CP|SCP|AFC|BSC|TSG|VfB|VfL|1\.\s*FC|1\.\s*FSV)$/i, "")
    .trim();
}

async function searchYouTube(
  query: string,
  matchDateUtc: string,
  channelId?: string,
): Promise<HighlightResult | null> {
  const matchDate = new Date(matchDateUtc);

  // Search window: from 1 hour before match to 48 hours after
  const publishedAfter = new Date(matchDate.getTime() - 1 * 60 * 60 * 1000).toISOString();
  const publishedBefore = new Date(matchDate.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "relevance");
  url.searchParams.set("publishedAfter", publishedAfter);
  url.searchParams.set("publishedBefore", publishedBefore);
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("key", YOUTUBE_API_KEY);

  if (channelId) {
    url.searchParams.set("channelId", channelId);
  }

  try {
    const res = await fetch(url.toString());

    if (!res.ok) {
      if (res.status === 403) {
        console.error("[youtube] API quota exceeded or forbidden");
      } else {
        console.error(`[youtube] API error: ${res.status} ${res.statusText}`);
      }
      return null;
    }

    const data: YouTubeSearchResponse = await res.json();

    if (!data.items?.length) return null;

    // Rank results: prefer trusted channels, then by relevance (API already sorts by relevance)
    const trustedChannelIds = new Set(Object.values(TRUSTED_CHANNELS));

    const scored = data.items
      .filter((item) => item.id.videoId) // Must be a video
      .map((item) => {
        let score = 0;

        // Boost trusted channels
        if (trustedChannelIds.has(item.snippet.channelId)) score += 100;

        // Boost if title contains "highlights"
        if (/highlights/i.test(item.snippet.title)) score += 50;

        // Boost if title contains both team names
        const title = item.snippet.title.toLowerCase();
        const homeClean = query.split(" vs ")[0]?.toLowerCase() || "";
        const awayClean = query.split(" vs ")[1]?.replace(" highlights", "")?.toLowerCase() || "";
        if (homeClean && title.includes(homeClean)) score += 20;
        if (awayClean && title.includes(awayClean)) score += 20;

        // Penalize shorts, reactions, predictions
        if (/\b(shorts?|reaction|preview|prediction|press conference|pre-match)\b/i.test(item.snippet.title)) {
          score -= 200;
        }

        return { item, score };
      })
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return null;

    const best = scored[0].item;
    return {
      videoId: best.id.videoId,
      title: best.snippet.title,
      channelTitle: best.snippet.channelTitle,
      publishedAt: best.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${best.id.videoId}`,
    };
  } catch (err) {
    console.warn("[youtube] Fetch error:", err);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
