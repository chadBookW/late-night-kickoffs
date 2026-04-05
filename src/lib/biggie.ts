import type { SupabaseClient } from "@supabase/supabase-js";

export type BiggieInput = {
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  homeIsBigTeam: boolean;
  awayIsBigTeam: boolean;
  matchweek: number | null;
  totalMatchweeks: number;
  leagueId: string;
};

export type BiggieResult = {
  isBiggie: boolean;
  reason: string | null;
};

const TOTAL_PL_MATCHWEEKS = 38;
const LATE_SEASON_THRESHOLD = 8;

export async function detectBiggie(
  supabase: SupabaseClient,
  input: BiggieInput
): Promise<BiggieResult> {
  const reasons: string[] = [];

  // 1. Both teams are big teams
  if (input.homeIsBigTeam && input.awayIsBigTeam) {
    reasons.push("Big team clash");
  }

  // 2. Known derby
  const isDerby = await checkDerby(
    supabase,
    input.homeTeamExternalId,
    input.awayTeamExternalId
  );
  if (isDerby) {
    reasons.push(`Derby: ${isDerby}`);
  }

  // 3. Top 6 clash or relegation zone clash (requires standings data)
  // For MVP, we rely on big team flags + derby mappings
  // Full standings-based logic would need an additional API call

  // 4. Late season weight
  if (input.matchweek) {
    const totalMW = input.totalMatchweeks || TOTAL_PL_MATCHWEEKS;
    const remainingWeeks = totalMW - input.matchweek;
    if (remainingWeeks <= LATE_SEASON_THRESHOLD) {
      if (input.homeIsBigTeam || input.awayIsBigTeam) {
        reasons.push("Late season high-stakes match");
      }
    }
  }

  return {
    isBiggie: reasons.length > 0,
    reason: reasons.length > 0 ? reasons.join("; ") : null,
  };
}

async function checkDerby(
  supabase: SupabaseClient,
  teamAExtId: string,
  teamBExtId: string
): Promise<string | null> {
  // Check both orderings
  const { data } = await supabase
    .from("derby_mappings")
    .select("derby_name")
    .or(
      `and(team_a_external_id.eq.${teamAExtId},team_b_external_id.eq.${teamBExtId}),and(team_a_external_id.eq.${teamBExtId},team_b_external_id.eq.${teamAExtId})`
    )
    .limit(1)
    .single();

  return data?.derby_name ?? null;
}
