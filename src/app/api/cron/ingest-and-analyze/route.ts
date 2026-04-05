import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const headers = { authorization: `Bearer ${process.env.CRON_SECRET}` };

  // Step 1: Run ingest and wait for it to finish
  const ingestRes = await fetch(`${appUrl}/api/jobs/ingest-matches`, {
    method: "POST",
    headers,
  });
  const ingestData = await ingestRes.json();

  if (!ingestRes.ok) {
    return NextResponse.json(
      { error: "Ingest failed", details: ingestData },
      { status: 500 }
    );
  }

  // Step 2: Fire-and-forget analyze (gets its own 10s serverless budget)
  fetch(`${appUrl}/api/jobs/analyze-matches`, {
    method: "POST",
    headers,
  }).catch((err) => console.error("[ingest-and-analyze] analyze trigger failed:", err));

  return NextResponse.json({
    success: true,
    ingest: ingestData,
    analyzeTriggered: true,
  });
}
