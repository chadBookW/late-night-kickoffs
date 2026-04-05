import { Client } from "@upstash/qstash";

let _qstash: Client | null = null;

function getQStash(): Client {
  if (!_qstash) {
    _qstash = new Client({
      token: process.env.QSTASH_TOKEN || "",
    });
  }
  return _qstash;
}

/**
 * Publish batched email sends to QStash.
 * Each message triggers /api/jobs/send-batch with a chunk of subscriber IDs.
 */
export async function publishEmailBatches({
  digestRunId,
  subscriberIds,
  batchSize = 50,
}: {
  digestRunId: string;
  subscriberIds: string[];
  batchSize?: number;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qstash = getQStash();

  const batches: string[][] = [];
  for (let i = 0; i < subscriberIds.length; i += batchSize) {
    batches.push(subscriberIds.slice(i, i + batchSize));
  }

  console.log(
    `[qstash] Publishing ${batches.length} batches for ${subscriberIds.length} subscribers`
  );

  const results = await Promise.allSettled(
    batches.map((batch, index) =>
      qstash.publishJSON({
        url: `${appUrl}/api/jobs/send-batch`,
        body: {
          digestRunId,
          subscriberIds: batch,
          batchIndex: index,
        },
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        retries: 3,
      })
    )
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[qstash] Published: ${succeeded} ok, ${failed} failed`);

  return { batches: batches.length, succeeded, failed };
}
