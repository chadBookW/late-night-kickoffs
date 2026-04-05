import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { triggerEmailSend } from "@/lib/email-trigger";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sc = await createServiceClient();

  // Mark as approved
  const { error } = await sc
    .from("digest_runs")
    .update({
      approval_status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("digest_date_ist", date);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[approve] Digest ${date} approved by ${user.email}`);

  // Trigger batched email send via QStash
  const sendResult = await triggerEmailSend(date, sc);

  // Audit log
  await sc.from("audit_logs").insert({
    actor_user_id: user.id,
    entity_type: "digest_run",
    entity_id: date,
    action: "approve",
    after_data: { approval_status: "approved", ...sendResult },
  });

  return NextResponse.json({ success: true, ...sendResult });
}
