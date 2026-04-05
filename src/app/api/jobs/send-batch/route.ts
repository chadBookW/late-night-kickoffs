import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/ses";
import { render } from "@react-email/render";
import { DailyDigestEmail } from "@/emails/daily-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  // Verify auth (CRON_SECRET or QStash signature)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { digestRunId, subscriberIds, batchIndex = 0 } = body as {
    digestRunId: string;
    subscriberIds: string[];
    batchIndex?: number;
  };

  if (!digestRunId || !subscriberIds?.length) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  console.log(
    `[send-batch] Batch ${batchIndex}: sending to ${subscriberIds.length} subscribers`
  );

  const supabase = await createServiceClient();

  // Fetch digest data once for the batch
  const { data: digestRun } = await supabase
    .from("digest_runs")
    .select("id, digest_date_ist")
    .eq("id", digestRunId)
    .single();

  if (!digestRun) {
    return NextResponse.json({ error: "Digest not found" }, { status: 404 });
  }

  const { data: digestMatches } = await supabase
    .from("digest_matches")
    .select("match_id, rank_order, featured_in_email")
    .eq("digest_run_id", digestRunId)
    .order("rank_order");

  if (!digestMatches?.length) {
    return NextResponse.json({ success: true, sent: 0, reason: "No matches" });
  }

  const matchIds = digestMatches.map((dm) => dm.match_id);
  const [matchRes, analysisRes, teamsRes, leaguesRes, linksRes] = await Promise.all([
    supabase.from("matches").select("*").in("id", matchIds),
    supabase.from("match_analysis").select("*").in("match_id", matchIds),
    supabase.from("teams").select("*"),
    supabase.from("leagues").select("*"),
    supabase.from("match_links").select("*").in("match_id", matchIds),
  ]);

  const matchMap = new Map((matchRes.data || []).map((m) => [m.id, m]));
  const analysisMap = new Map((analysisRes.data || []).map((a) => [a.match_id, a]));
  const teamsMap = new Map((teamsRes.data || []).map((t) => [t.id, t]));
  const leaguesMap = new Map((leaguesRes.data || []).map((l) => [l.id, l]));
  const linksMap = new Map<string, { url: string }[]>();
  for (const link of linksRes.data || []) {
    if (!linksMap.has(link.match_id)) linksMap.set(link.match_id, []);
    linksMap.get(link.match_id)!.push(link);
  }

  // Build full match list
  const allMatches = digestMatches.map((dm) => {
    const match = matchMap.get(dm.match_id);
    const analysis = analysisMap.get(dm.match_id);
    const homeTeam = match ? teamsMap.get(match.home_team_id) : null;
    const awayTeam = match ? teamsMap.get(match.away_team_id) : null;
    const league = match ? leaguesMap.get(match.league_id) : null;
    const links = linksMap.get(dm.match_id) || [];

    return {
      matchId: dm.match_id,
      leagueId: match?.league_id,
      leagueCode: league?.code,
      homeTeam: homeTeam?.name || "Home",
      awayTeam: awayTeam?.name || "Away",
      leagueName: league?.name || "",
      matchweek: match?.matchweek,
      tier: analysis?.primary_tier || "snoozefest",
      isBiggie: analysis?.is_biggie || false,
      summary: analysis?.summary_short || "",
      highlightUrl: links[0]?.url || null,
      featuredInEmail: dm.featured_in_email,
    };
  });

  // Fetch subscribers
  const { data: subscribers } = await supabase
    .from("subscribers")
    .select("id, email, token, leagues")
    .in("id", subscriberIds)
    .eq("confirmed", true)
    .is("unsubscribed_at", null);

  if (!subscribers?.length) {
    return NextResponse.json({ success: true, sent: 0, reason: "No eligible subscribers" });
  }

  // ── Idempotency: fetch already-sent log entries for this digest+batch ──
  const { data: alreadySent } = await supabase
    .from("email_send_log")
    .select("subscriber_id")
    .eq("digest_run_id", digestRunId)
    .in("subscriber_id", subscriberIds)
    .not("ses_message_id", "is", null);

  const sentSet = new Set((alreadySent || []).map((r) => r.subscriber_id));

  let sentCount = 0;
  let skippedCount = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const subscriber of subscribers) {
    // Skip if already successfully sent (QStash retry scenario)
    if (sentSet.has(subscriber.id)) {
      skippedCount++;
      continue;
    }

    try {
      // Filter matches by subscriber's league preferences
      const subLeagues = subscriber.leagues || [];
      const filteredMatches = allMatches.filter(
        (m) => subLeagues.length === 0 || subLeagues.includes(m.leagueCode || "")
      );

      if (filteredMatches.length === 0) continue;

      // Count tiers for subject line
      const bangerCount = filteredMatches.filter((m) => m.tier === "banger").length;
      const watchCount = filteredMatches.filter((m) => m.tier === "worth_a_watch").length;

      const tierParts: string[] = [];
      if (bangerCount > 0) tierParts.push(`${bangerCount} Banger${bangerCount > 1 ? "s" : ""}`);
      if (watchCount > 0) tierParts.push(`${watchCount} Worth a Watch`);

      const dateStr = digestRun.digest_date_ist;
      const dateFormatted = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const subject = tierParts.length > 0
        ? `LNK — ${dateFormatted} | ${tierParts.join(", ")}`
        : `LNK — ${dateFormatted} | Your Digest`;

      const unsubscribeUrl = `${appUrl}/unsubscribe?token=${subscriber.token}`;
      const preferencesUrl = `${appUrl}/preferences?token=${subscriber.token}`;

      const html = await render(
        DailyDigestEmail({
          matches: filteredMatches,
          digestDate: dateFormatted,
          unsubscribeUrl,
          preferencesUrl,
        })
      );

      const { messageId } = await sendEmail({
        to: subscriber.email,
        subject,
        html,
      });

      // Log the send
      await supabase.from("email_send_log").insert({
        subscriber_id: subscriber.id,
        digest_run_id: digestRunId,
        ses_message_id: messageId,
      });

      sentCount++;
    } catch (err) {
      console.error(`[send-batch] Error sending to ${subscriber.email}:`, err);

      await supabase.from("email_send_log").insert({
        subscriber_id: subscriber.id,
        digest_run_id: digestRunId,
        error_message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  console.log(`[send-batch] Batch ${batchIndex}: sent=${sentCount}, skipped=${skippedCount}, total=${subscribers.length}`);

  return NextResponse.json({ success: true, sent: sentCount, skipped: skippedCount, total: subscribers.length });
}
