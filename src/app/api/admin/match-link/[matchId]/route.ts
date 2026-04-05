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

  if (!body.url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  // Upsert highlight link
  const { data: existing } = await sc
    .from("match_links")
    .select("id")
    .eq("match_id", matchId)
    .eq("link_type", "highlights")
    .single();

  if (existing) {
    await sc
      .from("match_links")
      .update({ url: body.url, provider: body.provider || "admin" })
      .eq("id", existing.id);
  } else {
    await sc.from("match_links").insert({
      match_id: matchId,
      link_type: "highlights",
      url: body.url,
      provider: body.provider || "admin",
      status: "active",
    });
  }

  // Audit log
  await sc.from("audit_logs").insert({
    actor_user_id: user.id,
    entity_type: "match_link",
    entity_id: matchId,
    action: "edit_link",
    after_data: { url: body.url },
  });

  return NextResponse.json({ success: true });
}
