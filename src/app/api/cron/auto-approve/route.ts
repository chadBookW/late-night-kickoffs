import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { triggerEmailSend } from "@/lib/email-trigger";
import { yesterdayIST } from "@/lib/ist-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const { dateStr } = yesterdayIST();

  // Check if digest exists and is still pending
  const { data: digestRun } = await supabase
    .from("digest_runs")
    .select("id, approval_status")
    .eq("digest_date_ist", dateStr)
    .single();

  if (!digestRun) {
    return NextResponse.json({ success: true, action: "no_digest", date: dateStr });
  }

  if (digestRun.approval_status === "approved") {
    return NextResponse.json({ success: true, action: "already_approved", date: dateStr });
  }

  // Check all analyses passed spoiler check
  const { data: analyses } = await supabase
    .from("match_analysis")
    .select("match_id, summary_status")
    .in(
      "match_id",
      (
        await supabase
          .from("digest_matches")
          .select("match_id")
          .eq("digest_run_id", digestRun.id)
      ).data?.map((dm: { match_id: string }) => dm.match_id) || []
    );

  const allPassed = analyses?.every(
    (a: { summary_status: string }) =>
      a.summary_status === "generated" ||
      a.summary_status === "template_fallback" ||
      a.summary_status === "admin_edited"
  );

  if (!allPassed) {
    console.log(`[auto-approve] Some summaries not approved for ${dateStr}, skipping`);
    return NextResponse.json({
      success: true,
      action: "skipped_unsafe",
      date: dateStr,
    });
  }

  // Auto-approve
  await supabase
    .from("digest_runs")
    .update({
      approval_status: "approved",
      auto_approved_at: new Date().toISOString(),
    })
    .eq("id", digestRun.id);

  console.log(`[auto-approve] Digest ${dateStr} auto-approved`);

  // Trigger email send
  const sendResult = await triggerEmailSend(dateStr, supabase);

  return NextResponse.json({
    success: true,
    action: "auto_approved",
    date: dateStr,
    ...sendResult,
  });
}
