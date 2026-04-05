import { publishEmailBatches } from "@/lib/qstash";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Trigger batched email send for a digest date.
 * Fetches the digest run and eligible subscribers, then publishes
 * batches to QStash for async processing.
 */
export async function triggerEmailSend(
  dateStr: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
) {
  // Get digest run
  const { data: digestRun } = await supabase
    .from("digest_runs")
    .select("id")
    .eq("digest_date_ist", dateStr)
    .single();

  if (!digestRun) {
    console.log(`[email-trigger] No digest run found for ${dateStr}`);
    return { subscribers: 0, batches: 0 };
  }

  const digestRunId = digestRun.id as string;

  // Get all confirmed, active subscribers
  const { data: subscribers } = await supabase
    .from("subscribers")
    .select("id")
    .eq("confirmed", true)
    .is("unsubscribed_at", null);

  if (!subscribers || subscribers.length === 0) {
    console.log("[email-trigger] No eligible subscribers");
    return { subscribers: 0, batches: 0 };
  }

  const subscriberIds = subscribers.map((s: { id: string }) => s.id);

  console.log(
    `[email-trigger] Triggering send for ${subscriberIds.length} subscribers, digest ${digestRunId}`
  );

  // If QStash token is not configured, fall back to direct send
  if (!process.env.QSTASH_TOKEN) {
    console.log("[email-trigger] No QSTASH_TOKEN — using direct send fallback");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      const res = await fetch(`${appUrl}/api/jobs/send-batch`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          digestRunId,
          subscriberIds,
          batchIndex: 0,
        }),
      });
      const data = await res.json();
      console.log("[email-trigger] Direct send result:", data);
      return { subscribers: subscriberIds.length, batches: 1, directResult: data };
    } catch (err) {
      console.error("[email-trigger] Direct send failed:", err);
      return { subscribers: subscriberIds.length, batches: 0, error: "Direct send failed" };
    }
  }

  // Publish batches to QStash
  const result = await publishEmailBatches({
    digestRunId,
    subscriberIds,
  });

  return { subscribers: subscriberIds.length, ...result };
}
