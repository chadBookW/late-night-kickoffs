import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !(await isAdmin(supabase, user.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sc = await createServiceClient();
  const body = await request.json();

  // Fetch current state for audit
  const { data: before } = await sc
    .from("match_analysis")
    .select("*")
    .eq("match_id", matchId)
    .single();

  // Build update object
  const update: Record<string, unknown> = {};
  if (body.summary_short !== undefined) update.summary_short = body.summary_short;
  if (body.primary_tier !== undefined) update.primary_tier = body.primary_tier;
  if (body.is_biggie !== undefined) update.is_biggie = body.is_biggie;
  if (body.summary_short !== undefined) update.summary_status = "admin_edited";
  update.admin_override = true;

  const { error } = await sc
    .from("match_analysis")
    .update(update)
    .eq("match_id", matchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Handle featured_in_email toggle if provided
  if (body.featured_in_email !== undefined && body.digest_run_id) {
    await sc
      .from("digest_matches")
      .update({ featured_in_email: body.featured_in_email })
      .eq("digest_run_id", body.digest_run_id)
      .eq("match_id", matchId);
  }

  // Audit log
  await sc.from("audit_logs").insert({
    actor_user_id: user.id,
    entity_type: "match_analysis",
    entity_id: matchId,
    action: "edit",
    before_data: before,
    after_data: update,
  });

  return NextResponse.json({ success: true });
}
