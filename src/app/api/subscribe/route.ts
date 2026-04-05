import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/ses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, leagues } = body as { email?: string; leagues?: string[] };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ error: "Select at least one league" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Check if already subscribed
  const { data: existing } = await supabase
    .from("subscribers")
    .select("id, confirmed, unsubscribed_at")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (existing) {
    if (existing.confirmed && !existing.unsubscribed_at) {
      return NextResponse.json({ error: "You're already subscribed!" }, { status: 409 });
    }

    // Re-subscribe or update leagues
    await supabase
      .from("subscribers")
      .update({
        leagues,
        unsubscribed_at: null,
        confirmed: existing.confirmed,
      })
      .eq("id", existing.id);

    if (existing.confirmed) {
      return NextResponse.json({ success: true, message: "Welcome back!" });
    }

    // Resend confirmation email
    await sendConfirmationEmail(email.toLowerCase().trim(), existing.id, supabase);
    return NextResponse.json({ success: true, message: "Confirmation email resent" });
  }

  // Insert new subscriber
  const { data: newSub, error } = await supabase
    .from("subscribers")
    .insert({
      email: email.toLowerCase().trim(),
      leagues,
      confirmed: false,
    })
    .select("id, token")
    .single();

  if (error || !newSub) {
    console.error("[subscribe] Insert error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  // Send confirmation email
  await sendConfirmationEmail(email.toLowerCase().trim(), newSub.id, supabase);

  return NextResponse.json({ success: true });
}

async function sendConfirmationEmail(
  email: string,
  subscriberId: string,
  supabase: Awaited<ReturnType<typeof createServiceClient>>
) {
  // Get the subscriber's token
  const { data: sub } = await supabase
    .from("subscribers")
    .select("token")
    .eq("id", subscriberId)
    .single();

  if (!sub) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const confirmUrl = `${appUrl}/api/confirm?token=${sub.token}`;

  console.log(`[subscribe] Confirmation URL for ${email}: ${confirmUrl}`);

  try {
    await sendEmail({
      to: email,
      subject: "Confirm your Late Night Kickoffs subscription",
      html: buildConfirmationHtml(confirmUrl),
    });
    console.log(`[subscribe] Confirmation email sent to ${email}`);
  } catch (err) {
    console.error(`[subscribe] Failed to send confirmation email to ${email}:`, err);
    // In dev mode, auto-confirm so the flow can be tested without email provider
    if (process.env.NODE_ENV === "development") {
      await supabase
        .from("subscribers")
        .update({ confirmed: true, confirmed_at: new Date().toISOString() })
        .eq("id", subscriberId);
      console.log(`[subscribe] Auto-confirmed ${email} (dev fallback)`);
    }
  }
}

function buildConfirmationHtml(confirmUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0">
        <!-- Header -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">Late Night Kickoffs</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#141414;border-radius:12px;padding:40px 32px;border:1px solid rgba(255,255,255,0.08);">
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#ffffff;">One last step</h2>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa;">
            Tap the button below to confirm your subscription and start receiving your spoiler-free morning digest.
          </p>
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 28px;">
              <a href="${confirmUrl}" style="display:inline-block;background:#059669;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;">
                Confirm my subscription
              </a>
            </td></tr>
          </table>
          <!-- What you'll get -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;">
            <tr><td>
              <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#ffffff;">Here&rsquo;s what you&rsquo;ll get:</p>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#a1a1aa;">
                &#9917; <strong style="color:#d4d4d8;">Ranked matches</strong> &mdash; scored by excitement so you know what&rsquo;s worth your time
              </p>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#a1a1aa;">
                &#128274; <strong style="color:#d4d4d8;">Spoiler-free</strong> &mdash; scores hidden until you choose to reveal them
              </p>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#a1a1aa;">
                &#9200; <strong style="color:#d4d4d8;">Every morning</strong> &mdash; delivered before you start your day
              </p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#a1a1aa;">
                &#127942; <strong style="color:#d4d4d8;">100% free</strong> &mdash; no credit card, no ads, just football
              </p>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:28px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#52525b;">
            If you didn&rsquo;t sign up for Late Night Kickoffs, just ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}
