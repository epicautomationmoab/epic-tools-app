import { Resend } from "resend";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function waiverBcc(recipient: string) {
  const configured = process.env.GUEST_EMAIL_BCC?.trim();
  if (!configured) return undefined;

  const normalizedRecipient = recipient.trim().toLowerCase();
  const recipients = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value.toLowerCase() !== normalizedRecipient);

  if (!recipients.length) return undefined;
  return recipients.length === 1 ? recipients[0] : recipients;
}

export function waiverEmailConfigured() {
  return ["RESEND_API_KEY", "GUEST_EMAIL_FROM"].every((name) => Boolean(process.env[name]?.trim()));
}

export async function sendWaiverCopyEmail(input: {
  email: string;
  signerName: string;
  pdf: Buffer;
  idempotencyKey: string;
}) {
  const firstName = input.signerName.trim().split(/\s+/)[0] || "Guest";
  const resend = new Resend(requiredEnv("RESEND_API_KEY"));
  const { data, error } = await resend.emails.send(
    {
      from: requiredEnv("GUEST_EMAIL_FROM"),
      to: input.email,
      replyTo: process.env.GUEST_EMAIL_REPLY_TO?.trim() || undefined,
      bcc: waiverBcc(input.email),
      subject: "Your signed Epic 4X4 Adventures waiver",
      html: `
        <div style="background:#f5f2ed;padding:32px 16px;font-family:Arial,sans-serif;color:#2b2b2b">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
            <h1 style="margin:0 0 18px;font-size:24px">Your Signed Waiver</h1>
            <p>Hi ${escapeHtml(firstName)},</p>
            <p>Thank you for completing your Epic 4X4 Adventures waiver.</p>
            <p>A copy of your signed agreement is attached for your records.</p>
            <p>We look forward to seeing you in Moab!</p>
            <p style="margin-top:28px"><strong>Epic 4X4 Adventures</strong></p>
          </div>
        </div>`,
      attachments: [
        {
          filename: "Epic-4X4-Signed-Waiver.pdf",
          content: input.pdf,
        },
      ],
    },
    { idempotencyKey: input.idempotencyKey },
  );

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Resend did not return a message ID.");
  return { messageId: data.id };
}
