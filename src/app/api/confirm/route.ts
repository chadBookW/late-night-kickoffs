import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=invalid-token", request.url));
  }

  const supabase = await createServiceClient();

  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("id, email, confirmed")
    .eq("token", token)
    .single();

  if (!subscriber) {
    return NextResponse.redirect(new URL("/?error=invalid-token", request.url));
  }

  if (!subscriber.confirmed) {
    await supabase
      .from("subscribers")
      .update({ confirmed: true, confirmed_at: new Date().toISOString() })
      .eq("id", subscriber.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL("/confirm", appUrl));
}
