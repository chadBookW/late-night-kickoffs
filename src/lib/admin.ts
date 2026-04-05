import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

export async function isAdmin(
  _supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  // Use service client to bypass RLS (admin_users has no SELECT policy)
  const sc = await createServiceClient();
  const { data } = await sc
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .single();

  return !!data;
}

export async function getDigestForAdmin(
  _supabase: SupabaseClient,
  dateIST: string
) {
  const supabase = await createServiceClient();
  const { data: digestRun } = await supabase
    .from("digest_runs")
    .select("*")
    .eq("digest_date_ist", dateIST)
    .single();

  if (!digestRun) return null;

  const { data: digestMatches } = await supabase
    .from("digest_matches")
    .select("match_id, rank_order, featured_in_email")
    .eq("digest_run_id", digestRun.id)
    .order("rank_order");

  if (!digestMatches || digestMatches.length === 0) {
    return { digestRun, matches: [] };
  }

  const matchIds = digestMatches.map((dm) => dm.match_id);

  const [matchRes, analysisRes, teamsRes, leaguesRes, linksRes, statsRes] =
    await Promise.all([
      supabase.from("matches").select("*").in("id", matchIds),
      supabase.from("match_analysis").select("*").in("match_id", matchIds),
      supabase.from("teams").select("*"),
      supabase.from("leagues").select("*"),
      supabase.from("match_links").select("*").in("match_id", matchIds),
      supabase.from("match_stats").select("*").in("match_id", matchIds),
    ]);

  const matchMap = new Map((matchRes.data || []).map((m) => [m.id, m]));
  const analysisMap = new Map(
    (analysisRes.data || []).map((a) => [a.match_id, a])
  );
  const teamsMap = new Map((teamsRes.data || []).map((t) => [t.id, t]));
  const leaguesMap = new Map((leaguesRes.data || []).map((l) => [l.id, l]));
  const linksData = linksRes.data || [];
  const linksMap = new Map<string, typeof linksData>();
  for (const link of linksRes.data || []) {
    if (!linksMap.has(link.match_id)) linksMap.set(link.match_id, []);
    linksMap.get(link.match_id)!.push(link);
  }
  const statsMap = new Map(
    (statsRes.data || []).map((s) => [s.match_id, s])
  );

  const matches = digestMatches.map((dm) => {
    const match = matchMap.get(dm.match_id);
    const analysis = analysisMap.get(dm.match_id);
    return {
      matchId: dm.match_id,
      rankOrder: dm.rank_order,
      featuredInEmail: dm.featured_in_email,
      match,
      analysis,
      homeTeam: match ? teamsMap.get(match.home_team_id) : null,
      awayTeam: match ? teamsMap.get(match.away_team_id) : null,
      league: match ? leaguesMap.get(match.league_id) : null,
      links: linksMap.get(dm.match_id) || [],
      stats: statsMap.get(dm.match_id) || null,
    };
  });

  return { digestRun, matches };
}
