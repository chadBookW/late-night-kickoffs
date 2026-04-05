import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getFinishedMatchesRange,
  mapStatus,
  formatRound,
  type FDMatch,
} from "@/lib/sports-api";
import { yesterdayIST, toISTDate, formatMatchweekFromRound, istDateToUtcRange } from "@/lib/ist-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Allow date override via request body for testing
  let overrideDate: string | null = null;
  try {
    const body = await request.json();
    if (body?.date) overrideDate = body.date;
  } catch {
    // No body or invalid JSON — use default
  }
  const { dateStr } = overrideDate ? { dateStr: overrideDate } : yesterdayIST();

  console.log(`[ingest] Starting ingest for IST date: ${dateStr}`);

  // Fetch active leagues — code is the football-data.org competition code (PL, CL, BL1, etc.)
  const { data: leagues, error: leagueErr } = await supabase
    .from("leagues")
    .select("id, code, external_league_id")
    .eq("is_active", true);

  if (leagueErr || !leagues) {
    console.error("[ingest] Failed to fetch leagues:", leagueErr);
    return NextResponse.json({ error: "Failed to fetch leagues" }, { status: 500 });
  }

  let totalIngested = 0;

  // Convert IST date to UTC date range for the API query.
  // IST day spans two UTC days (e.g., IST Apr 5 = UTC Apr 4 18:30 → Apr 5 18:29).
  const { utcFrom, utcTo } = istDateToUtcRange(dateStr);
  console.log(`[ingest] UTC range for IST ${dateStr}: ${utcFrom} → ${utcTo}`);

  for (const league of leagues) {
    // Use the league code (e.g. "PL") for football-data.org
    const competitionCode = league.code;
    if (!competitionCode) continue;

    console.log(`[ingest] Fetching matches for ${competitionCode}`);

    let matches: FDMatch[];
    try {
      matches = await getFinishedMatchesRange(competitionCode, utcFrom, utcTo);
    } catch (err) {
      console.error(`[ingest] API error for ${competitionCode}:`, err);
      continue;
    }

    // Filter to only matches whose kickoff falls within our target IST date
    const filtered = matches.filter((m) => toISTDate(m.utcDate) === dateStr);
    console.log(`[ingest] Found ${matches.length} finished matches, ${filtered.length} on IST ${dateStr} for ${competitionCode}`);

    for (const match of filtered) {
      try {
        await processMatch(supabase, match, league.id);
        totalIngested++;
      } catch (err) {
        console.error(`[ingest] Error processing match ${match.id}:`, err);
      }
    }
  }

  console.log(`[ingest] Completed. Ingested ${totalIngested} matches for ${dateStr}`);

  return NextResponse.json({
    success: true,
    date: dateStr,
    matchesIngested: totalIngested,
  });
}

async function processMatch(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  match: FDMatch,
  leagueId: string
) {
  const externalMatchId = String(match.id);
  const homeExtId = String(match.homeTeam.id);
  const awayExtId = String(match.awayTeam.id);

  // Upsert home team
  const homeTeamId = await upsertTeam(supabase, {
    externalId: homeExtId,
    name: match.homeTeam.name,
    shortName: match.homeTeam.shortName,
    tla: match.homeTeam.tla,
    leagueId,
  });

  // Upsert away team
  const awayTeamId = await upsertTeam(supabase, {
    externalId: awayExtId,
    name: match.awayTeam.name,
    shortName: match.awayTeam.shortName,
    tla: match.awayTeam.tla,
    leagueId,
  });

  // Compute IST date for the kickoff
  const matchDateIST = toISTDate(match.utcDate);
  const round = formatRound(match);
  const matchweek = formatMatchweekFromRound(round);
  const status = mapStatus(match);

  // Extract season year from season start date (e.g. "2025-08-15" → "2025")
  const seasonYear = match.season.startDate?.split("-")[0] || "";

  // Upsert match
  const { data: matchData, error: matchErr } = await supabase
    .from("matches")
    .upsert(
      {
        external_match_id: externalMatchId,
        league_id: leagueId,
        season: seasonYear,
        stage: round,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: match.utcDate,
        status,
        match_date_ist: matchDateIST,
        matchweek,
        home_score: match.score.fullTime.home,
        away_score: match.score.fullTime.away,
        raw_payload: match as unknown as Record<string, unknown>,
      },
      { onConflict: "external_match_id" }
    )
    .select("id")
    .single();

  if (matchErr || !matchData) {
    throw new Error(`Failed to upsert match ${externalMatchId}: ${matchErr?.message}`);
  }

  const matchId = matchData.id;

  // football-data.org free tier does not provide per-match stats (shots, possession, etc.)
  // We store what we can derive: halftime score implies comeback potential,
  // penalty shootout duration implies penalties were taken.
  const isPenaltyShootout = match.score.duration === "PENALTY_SHOOTOUT";

  await supabase.from("match_stats").upsert(
    {
      match_id: matchId,
      possession_home: null,
      possession_away: null,
      shots_home: null,
      shots_away: null,
      shots_on_target_home: null,
      shots_on_target_away: null,
      xg_home: null,
      xg_away: null,
      red_cards_home: 0,
      red_cards_away: 0,
      yellow_cards_home: 0,
      yellow_cards_away: 0,
      corners_home: null,
      corners_away: null,
      fouls_home: null,
      fouls_away: null,
      penalties: isPenaltyShootout ? 1 : 0,
      events: [] as unknown as Record<string, unknown>,
    },
    { onConflict: "match_id" }
  );
}

async function upsertTeam(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  team: { externalId: string; name: string; shortName: string; tla: string; leagueId: string }
): Promise<string> {
  // Check if team exists
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("external_team_id", team.externalId)
    .single();

  if (existing) return existing.id;

  // Insert new team
  const slug = team.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data: newTeam, error } = await supabase
    .from("teams")
    .upsert(
      {
        external_team_id: team.externalId,
        name: team.name,
        short_name: team.tla || team.shortName,
        slug,
        league_id: team.leagueId,
      },
      { onConflict: "external_team_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (error || !newTeam) {
    throw new Error(`Failed to upsert team ${team.name}: ${error?.message}`);
  }

  return newTeam.id;
}
