import { Resend } from "resend";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let _resend: Resend | null = null;
let _ses: SESClient | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "");
  }
  return _resend;
}

function getSES(): SESClient {
  if (!_ses) {
    _ses = new SESClient({
      region: process.env.AWS_SES_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return _ses;
}

type EmailProvider = "resend" | "ses" | "dev";

function pickProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "your-resend-api-key") {
    return "resend";
  }
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== "your-aws-access-key") {
    return "ses";
  }
  return "dev";
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string | undefined }> {
  const provider = pickProvider();
  const fromEmail = process.env.SES_FROM_EMAIL || "digest@footballdigest.com";

  if (provider === "resend") {
    const resend = getResend();
    const fromAddr = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    console.log(`[email] Sending via Resend from="${fromAddr}" to="${to}" subject="${subject}"`);
    const { data, error } = await resend.emails.send({
      from: `Late Night Kickoffs <${fromAddr}>`,
      to,
      subject,
      html,
    });
    if (error) {
      console.error(`[email] Resend error:`, error);
      throw new Error(error.message);
    }
    console.log(`[email] Sent via Resend to=${to} messageId=${data?.id}`);
    return { messageId: data?.id };
  }

  if (provider === "ses") {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
        },
      },
    });
    const result = await getSES().send(command);
    console.log(`[email] Sent via SES to=${to}`);
    return { messageId: result.MessageId };
  }

  // Dev mode fallback
  const devId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[email-dev] Would send to=${to} subject="${subject}" (${html.length} chars)`);
  return { messageId: devId };
}
