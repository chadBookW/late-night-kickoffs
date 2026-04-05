import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveHighlightLink(
  supabase: SupabaseClient,
  matchId: string,
  homeTeam: string,
  awayTeam: string
): Promise<string | null> {
  // Check if a link already exists
  const { data: existing } = await supabase
    .from("match_links")
    .select("url")
    .eq("match_id", matchId)
    .eq("link_type", "highlights")
    .eq("status", "active")
    .single();

  if (existing?.url) return existing.url;

  // Try to construct a YouTube search URL as fallback
  const searchQuery = encodeURIComponent(
    `${homeTeam} vs ${awayTeam} highlights`
  );
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;

  // Store it as a search link (not a direct link)
  await supabase.from("match_links").insert({
    match_id: matchId,
    link_type: "highlights",
    url: youtubeSearchUrl,
    provider: "youtube_search",
    status: "active",
  });

  return youtubeSearchUrl;
}

export async function resolveHighlightsForDigest(
  supabase: SupabaseClient,
  digestRunId: string
): Promise<number> {
  const { data: digestMatches } = await supabase
    .from("digest_matches")
    .select("match_id")
    .eq("digest_run_id", digestRunId);

  if (!digestMatches) return 0;

  let resolved = 0;

  for (const dm of digestMatches) {
    // Get match + team info
    const { data: match } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id")
      .eq("id", dm.match_id)
      .single();

    if (!match) continue;

    const [homeRes, awayRes] = await Promise.all([
      supabase.from("teams").select("name").eq("id", match.home_team_id).single(),
      supabase.from("teams").select("name").eq("id", match.away_team_id).single(),
    ]);

    const link = await resolveHighlightLink(
      supabase,
      dm.match_id,
      homeRes.data?.name || "Home",
      awayRes.data?.name || "Away"
    );

    if (link) resolved++;
  }

  return resolved;
}
