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

function agreementBcc(recipient: string) {
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

export function agreementEmailConfigured() {
  return ["RESEND_API_KEY", "GUEST_EMAIL_FROM"].every((name) => Boolean(process.env[name]?.trim()));
}

export async function sendAgreementEmail(input: {
  email: string;
  customerName: string;
  confirmationCode: string;
  agreementUrl: string;
  idempotencyKey: string;
}) {
  const firstName = input.customerName.trim().split(/\s+/)[0] || "Guest";
  const resend = new Resend(requiredEnv("RESEND_API_KEY"));
  const { data, error } = await resend.emails.send(
    {
      from: requiredEnv("GUEST_EMAIL_FROM"),
      to: input.email,
      replyTo: process.env.GUEST_EMAIL_REPLY_TO?.trim() || undefined,
      bcc: agreementBcc(input.email),
      subject: `Action required for Epic reservation ${input.confirmationCode}`,
      html: `
        <div style="background:#f5f2ed;padding:32px 16px;font-family:Arial,sans-serif;color:#2b2b2b">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
            <h1 style="margin:0 0 18px;font-size:24px">Cancellation Policy Agreement</h1>
            <p>Hi ${escapeHtml(firstName)},</p>
            <p>Please review and sign the cancellation terms for Epic 4X4 Adventures reservation <strong>${escapeHtml(input.confirmationCode)}</strong>.</p>
            <p style="margin:28px 0">
              <a href="${escapeHtml(input.agreementUrl)}" style="display:inline-block;background:#b9442e;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700">Review &amp; Sign Agreement</a>
            </p>
            <p style="font-size:13px;color:#666">This secure link is unique to your reservation and expires after 48 hours.</p>
          </div>
        </div>`,
    },
    { idempotencyKey: input.idempotencyKey },
  );
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Resend did not return a message ID.");
  return { messageId: data.id };
}
