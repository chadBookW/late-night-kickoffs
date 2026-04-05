/**
 * Quick DB check script — run with: npx tsx scripts/check-db.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check all matches
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, external_match_id, match_date_ist, status, home_score, away_score, home_team_id, away_team_id, league_id")
    .order("match_date_ist", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching matches:", error);
    return;
  }

  console.log(`\n=== Matches in DB (${matches?.length || 0}) ===`);
  for (const m of matches || []) {
    // Get team names
    const { data: home } = await supabase.from("teams").select("name").eq("id", m.home_team_id).single();
    const { data: away } = await supabase.from("teams").select("name").eq("id", m.away_team_id).single();
    console.log(`  ${m.match_date_ist} | ${home?.name} ${m.home_score}-${m.away_score} ${away?.name} | status=${m.status} | id=${m.id}`);
  }

  // Check match_links
  const { data: links } = await supabase.from("match_links").select("*").limit(20);
  console.log(`\n=== Match Links (${links?.length || 0}) ===`);
  for (const l of links || []) {
    console.log(`  match_id=${l.match_id} | type=${l.link_type} | provider=${l.provider} | url=${l.url}`);
  }

  // Check match_analysis
  const { data: analyses } = await supabase.from("match_analysis").select("match_id, excitement_score, primary_tier, is_biggie, summary_short").limit(20);
  console.log(`\n=== Match Analysis (${analyses?.length || 0}) ===`);
  for (const a of analyses || []) {
    console.log(`  match_id=${a.match_id} | score=${a.excitement_score} | tier=${a.primary_tier} | biggie=${a.is_biggie}`);
    if (a.summary_short) console.log(`    summary: ${a.summary_short.substring(0, 80)}...`);
  }
}

main().catch(console.error);
