import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeExcitementScore } from "@/lib/scoring";
import { detectBiggie } from "@/lib/biggie";
import { generateSummary, goalsToBucket } from "@/lib/summary";
import { yesterdayIST } from "@/lib/ist-utils";
import { findPostMatchThread } from "@/lib/reddit-api";
import { findHighlightVideo } from "@/lib/youtube-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Hobby limit: 60s. Reserve 5s for final DB writes.
const TIME_BUDGET_MS = 55_000;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Allow date override via request body for testing
  let overrideDate: string | null = null;
  try {
    const body = await request.clone().json();
    if (body?.date) overrideDate = body.date;
  } catch {
    // No body or invalid JSON — use default
  }
  const { dateStr } = overrideDate ? { dateStr: overrideDate } : yesterdayIST();

  console.log(`[analyze] Starting analysis for IST date: ${dateStr}`);

  // Create or get digest run
  const { data: digestRun, error: drErr } = await supabase
    .from("digest_runs")
    .upsert(
      {
        digest_date_ist: dateStr,
        generation_started_at: new Date().toISOString(),
        approval_status: "pending",
      },
      { onConflict: "digest_date_ist" }
    )
    .select("id")
    .single();

  if (drErr || !digestRun) {
    console.error("[analyze] Failed to create digest run:", drErr);
    return NextResponse.json({ error: "Failed to create digest run" }, { status: 500 });
  }

  // Fetch unanalyzed matches for yesterday
  const { data: matches, error: mErr } = await supabase
    .from("matches")
    .select(`
      id,
      external_match_id,
      league_id,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      status,
      matchweek,
      raw_payload
    `)
    .eq("match_date_ist", dateStr)
    .in("status", ["FT", "AET", "PEN"]);

  if (mErr || !matches) {
    console.error("[analyze] Failed to fetch matches:", mErr);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }

  if (matches.length === 0) {
    console.log("[analyze] No matches found for", dateStr);
    await supabase
      .from("digest_runs")
      .update({ generation_completed_at: new Date().toISOString() })
      .eq("id", digestRun.id);
    return NextResponse.json({ success: true, matchesAnalyzed: 0 });
  }

  console.log(`[analyze] Found ${matches.length} matches to analyze`);

  const startTime = Date.now();

  type AnalyzedMatch = {
    matchId: string;
    excitementScore: number;
    tier: "banger" | "worth_a_watch" | "snoozefest";
    isBiggie: boolean;
  };

  const analyzed: AnalyzedMatch[] = [];

  for (const match of matches) {
    // Check time budget before starting a new match
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      console.warn(`[analyze] Time budget exhausted after ${analyzed.length}/${matches.length} matches`);
      break;
    }

    try {
      // Extract halftime and duration from raw_payload (football-data.org response)
      const payload = match.raw_payload as Record<string, unknown> | null;
      const score = payload?.score as {
        halfTime?: { home: number | null; away: number | null };
        duration?: string;
      } | null;

      const halfTimeHome = score?.halfTime?.home ?? null;
      const halfTimeAway = score?.halfTime?.away ?? null;

      // Map DB status back to duration
      let duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" = "REGULAR";
      if (match.status === "PEN") duration = "PENALTY_SHOOTOUT";
      else if (match.status === "AET") duration = "EXTRA_TIME";

      // Fetch team info for biggie detection
      const { data: homeTeam } = await supabase
        .from("teams")
        .select("external_team_id, name, is_big_team")
        .eq("id", match.home_team_id)
        .single();

      const { data: awayTeam } = await supabase
        .from("teams")
        .select("external_team_id, name, is_big_team")
        .eq("id", match.away_team_id)
        .single();

      // Detect biggie
      const biggie = await detectBiggie(supabase, {
        homeTeamExternalId: homeTeam?.external_team_id || "",
        awayTeamExternalId: awayTeam?.external_team_id || "",
        homeIsBigTeam: homeTeam?.is_big_team || false,
        awayIsBigTeam: awayTeam?.is_big_team || false,
        matchweek: match.matchweek,
        totalMatchweeks: 38,
        leagueId: match.league_id,
      });

      // Fetch Reddit engagement (best-effort, won't fail the analysis)
      let redditComments: number | null = null;
      let redditUpvotes: number | null = null;
      try {
        const reddit = await findPostMatchThread(
          homeTeam?.name || "",
          awayTeam?.name || "",
          payload?.utcDate as string || new Date().toISOString(),
        );
        if (reddit) {
          redditComments = reddit.comments;
          redditUpvotes = reddit.upvotes;
          console.log(`[analyze] Reddit: ${reddit.comments} comments, ${reddit.upvotes} upvotes for ${homeTeam?.name} vs ${awayTeam?.name}`);
        }
      } catch (err) {
        console.warn(`[analyze] Reddit fetch failed for ${homeTeam?.name} vs ${awayTeam?.name}:`, err);
      }

      // Compute excitement score (with Reddit + biggie signals)
      const scoring = computeExcitementScore({
        homeScore: match.home_score ?? 0,
        awayScore: match.away_score ?? 0,
        halfTimeHome,
        halfTimeAway,
        duration,
        redditComments,
        redditUpvotes,
        isBiggie: biggie.isBiggie,
      });

      // Detect comeback for summary
      const hasComeback = scoring.breakdown.drama > 0 &&
        halfTimeHome !== null && halfTimeAway !== null &&
        halfTimeHome !== halfTimeAway;

      // Reddit buzz level for summary
      const redditBuzzLevel = (redditComments ?? 0) >= 3000 ? "high" as const
        : (redditComments ?? 0) >= 1000 ? "moderate" as const
        : (redditComments ?? 0) >= 200 ? "low" as const
        : "none" as const;

      // Fetch league info for summary
      const { data: league } = await supabase
        .from("leagues")
        .select("name")
        .eq("id", match.league_id)
        .single();

      // Generate summary
      const totalGoals = (match.home_score ?? 0) + (match.away_score ?? 0);

      const { summary, status: summaryStatus } = await generateSummary({
        homeTeam: homeTeam?.name || "Home",
        awayTeam: awayTeam?.name || "Away",
        league: league?.name || "Unknown",
        goalBucket: goalsToBucket(totalGoals),
        hasComeback,
        hasExtraTime: duration === "EXTRA_TIME" || duration === "PENALTY_SHOOTOUT",
        hasPenaltyShootout: duration === "PENALTY_SHOOTOUT",
        isRivalry: biggie.reason?.includes("Derby") || false,
        isBiggie: biggie.isBiggie,
        redditBuzz: redditBuzzLevel,
        tier: scoring.primaryTier,
      });

      // Upsert analysis
      await supabase.from("match_analysis").upsert(
        {
          match_id: match.id,
          excitement_score: scoring.excitementScore,
          primary_tier: scoring.primaryTier,
          is_biggie: biggie.isBiggie,
          biggie_reason: biggie.reason,
          summary_short: summary,
          summary_status: summaryStatus,
          spoiler_policy_version: "v1",
          generated_by: "system",
        },
        { onConflict: "match_id" }
      );

      // Fetch YouTube highlight video (best-effort)
      try {
        const { data: leagueForCode } = await supabase
          .from("leagues")
          .select("code")
          .eq("id", match.league_id)
          .single();

        const highlight = await findHighlightVideo(
          homeTeam?.name || "",
          awayTeam?.name || "",
          payload?.utcDate as string || new Date().toISOString(),
          leagueForCode?.code || undefined,
        );

        if (highlight) {
          // Delete existing highlight links for this match, then insert fresh
          await supabase
            .from("match_links")
            .delete()
            .eq("match_id", match.id)
            .eq("link_type", "highlights");

          await supabase.from("match_links").insert({
            match_id: match.id,
            link_type: "highlights",
            url: highlight.url,
            provider: `youtube:${highlight.channelTitle}`,
            status: "active",
          });

          console.log(
            `[analyze] YouTube highlight: ${highlight.title} (${highlight.channelTitle}) for ${homeTeam?.name} vs ${awayTeam?.name}`
          );
        }
      } catch (err) {
        console.warn(`[analyze] YouTube fetch failed for ${homeTeam?.name} vs ${awayTeam?.name}:`, err);
      }

      analyzed.push({
        matchId: match.id,
        excitementScore: scoring.excitementScore,
        tier: scoring.primaryTier,
        isBiggie: biggie.isBiggie,
      });

      console.log(
        `[analyze] ${homeTeam?.name} vs ${awayTeam?.name}: score=${scoring.excitementScore}, tier=${scoring.primaryTier}, biggie=${biggie.isBiggie}`
      );
    } catch (err) {
      console.error(`[analyze] Error analyzing match ${match.id}:`, err);
    }
  }

  // Rank matches: Biggies first, then by tier priority, then by excitement score
  const tierOrder = { banger: 0, worth_a_watch: 1, snoozefest: 2 };
  analyzed.sort((a, b) => {
    // Biggies first
    if (a.isBiggie && !b.isBiggie) return -1;
    if (!a.isBiggie && b.isBiggie) return 1;
    // Then by tier
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
    if (tierDiff !== 0) return tierDiff;
    // Then by excitement score
    return b.excitementScore - a.excitementScore;
  });

  // Clear existing digest matches and re-insert
  await supabase
    .from("digest_matches")
    .delete()
    .eq("digest_run_id", digestRun.id);

  const digestMatchRows = analyzed.map((m, idx) => ({
    digest_run_id: digestRun.id,
    match_id: m.matchId,
    rank_order: idx + 1,
    featured_in_email: idx < 6,
  }));

  if (digestMatchRows.length > 0) {
    await supabase.from("digest_matches").insert(digestMatchRows);
  }

  // Mark digest run as generated
  await supabase
    .from("digest_runs")
    .update({ generation_completed_at: new Date().toISOString() })
    .eq("id", digestRun.id);

  console.log(`[analyze] Completed. Analyzed ${analyzed.length} matches.`);

  return NextResponse.json({
    success: true,
    date: dateStr,
    matchesAnalyzed: analyzed.length,
    digestRunId: digestRun.id,
  });
}
