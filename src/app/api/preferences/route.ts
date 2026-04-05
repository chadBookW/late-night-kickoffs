import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET — fetch current preferences by token
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("leagues, frequency")
    .eq("token", token)
    .is("unsubscribed_at", null)
    .single();

  if (!subscriber) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(subscriber);
}

// PUT — update preferences by token
export async function PUT(request: Request) {
  const body = await request.json();
  const { token, leagues, frequency } = body as {
    token?: string;
    leagues?: string[];
    frequency?: string;
  };

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("id")
    .eq("token", token)
    .is("unsubscribed_at", null)
    .single();

  if (!subscriber) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (leagues && leagues.length > 0) update.leagues = leagues;
  if (frequency) update.frequency = frequency;

  const { error } = await supabase
    .from("subscribers")
    .update(update)
    .eq("id", subscriber.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
