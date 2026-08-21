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

export function waiverEmailConfigured() {
  return ["RESEND_API_KEY", "GUEST_EMAIL_FROM"].every((name) => Boolean(process.env[name]?.trim()));
}

export async function sendWaiverCopyEmail(input: {
  email: string;
  signerName: string;
  pdf: Buffer;
  idempotencyKey: string;
  documentTitle?: string;
  filename?: string;
}) {
  const firstName = input.signerName.trim().split(/\s+/)[0] || "Guest";
  const documentTitle = input.documentTitle?.trim() || "Waiver";
  const filename = input.filename?.trim() || "Epic-4X4-Signed-Waiver.pdf";
  const isDamageAcknowledgment = documentTitle === "Vehicle Damage Acknowledgment and Next Steps";

  const completionCopy = isDamageAcknowledgment
    ? "Thank you for completing your Epic 4X4 Adventures vehicle damage acknowledgment and next steps."
    : `Thank you for completing your Epic 4X4 Adventures ${documentTitle.toLowerCase()}.`;

  const attachmentCopy = isDamageAcknowledgment
    ? "A copy of your signed acknowledgment is attached for your records."
    : "A copy of your signed agreement is attached for your records.";

  const closingCopy = isDamageAcknowledgment
    ? `<p>Thank you for your cooperation. Epic 4X4 Adventures reserves all rights and remedies afforded to us in your signed documents. We will strive to resolve this matter promptly and will be in contact with you regarding next steps.</p>`
    : `<p>We look forward to seeing you in Moab!</p>`;

  const resend = new Resend(requiredEnv("RESEND_API_KEY"));
  const { data, error } = await resend.emails.send(
    {
      from: requiredEnv("GUEST_EMAIL_FROM"),
      to: input.email,
      replyTo: process.env.GUEST_EMAIL_REPLY_TO?.trim() || undefined,
      subject: `Your signed Epic 4X4 Adventures ${documentTitle}`,
      html: `
        <div style="background:#f5f2ed;padding:32px 16px;font-family:Arial,sans-serif;color:#2b2b2b">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
            <h1 style="margin:0 0 18px;font-size:24px">Your Signed ${escapeHtml(documentTitle)}</h1>
            <p>Hi ${escapeHtml(firstName)},</p>
            <p>${escapeHtml(completionCopy)}</p>
            <p>${escapeHtml(attachmentCopy)}</p>
            ${closingCopy}
            <p style="margin-top:28px"><strong>Epic 4X4 Adventures</strong></p>
          </div>
        </div>`,
      attachments: [
        {
          filename,
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
