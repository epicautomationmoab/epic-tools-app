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

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "Guest";
}

const GOOGLE_REVIEW_URL = "https://g.page/r/CSyp1o_uusOTEAE/review";
const TRIPADVISOR_REVIEW_URL = "https://www.tripadvisor.com/UserReviewEdit-g60724-d20358842-Epic_4X4_Adventures-Moab_Utah.html";
const FACEBOOK_URL = "https://www.facebook.com/epic4x4adventures";
const INSTAGRAM_URL = "https://www.instagram.com/epic4x4adventures/";

function experienceParagraph(businessLine: "tour" | "rental") {
  if (businessLine === "tour") {
    return "We loved having you out on the trail with us. Every group brings its own energy to the experience, and we hope the scenery, the terrain, the laughs, and the moments along the way gave you something you’ll remember long after the dust settles.";
  }

  return "We hope your time behind the wheel gave you the freedom to explore Moab your way and made for a day worth remembering. There’s nothing quite like seeing this place from the trail, and we’re glad we got to be part of your adventure.";
}

function reviewBlock() {
  return `
    <div style="margin:28px 0 24px;padding:22px;border:1px solid #ead7d2;border-radius:14px;background:#fffaf8">
      <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#3a3a3a">
        If you enjoyed your experience, we’d be grateful if you took a moment to share it with others. Reviews on Google and TripAdvisor help future guests choose their Moab adventure and mean a great deal to our team.
      </p>
      <div style="font-size:0">
        <a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;margin:0 10px 10px 0;padding:11px 18px;border-radius:8px;background:#4285f4;color:#fff;font-size:14px;font-weight:800;text-decoration:none">Review on Google</a>
        <a href="${TRIPADVISOR_REVIEW_URL}" style="display:inline-block;margin:0 0 10px;padding:11px 18px;border-radius:8px;background:#34e0a1;color:#111;font-size:14px;font-weight:800;text-decoration:none">Review on TripAdvisor</a>
      </div>
    </div>`;
}

export function renderPostVisitEmailHtml(input: {
  signerName: string;
  businessLine: "tour" | "rental";
  sendMode: "review_request" | "thank_you_only";
}) {
  const greetingName = escapeHtml(firstName(input.signerName));
  const experienceCopy = escapeHtml(experienceParagraph(input.businessLine));
  const review = input.sendMode === "review_request" ? reviewBlock() : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Thank you for choosing Epic 4X4 Adventures</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f2ed">
    <div style="margin:0;padding:32px 14px;background:#f5f2ed;font-family:Arial,Helvetica,sans-serif;color:#222">
      <div style="max-width:620px;margin:0 auto">
        <div style="background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(0,0,0,.06);overflow:hidden">
          <div style="padding:28px 30px 12px;text-align:center">
            <img src="https://team.myepicreservation.com/epic-logo-black.png" alt="Epic 4X4 Adventures" width="250" style="display:inline-block;max-width:82%;height:auto;border:0" />
          </div>
          <div style="padding:18px 34px 32px">
            <h1 style="margin:0 0 22px;font-size:30px;line-height:1.2;color:#202733">It’s our guests who make us Epic.</h1>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#3a3a3a">Hi ${greetingName},</p>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#3a3a3a">
              Thank you for choosing <strong>Epic 4X4 Adventures</strong> for your Moab adventure. We’re grateful you chose to spend part of your trip with us, and we hope your experience was everything you imagined — and maybe a little more.
            </p>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#3a3a3a">${experienceCopy}</p>
            ${review}
            <p style="margin:22px 0 18px;font-size:16px;line-height:1.65;color:#3a3a3a">
              We’d also love to stay connected. Follow us on <a href="${FACEBOOK_URL}" style="color:#b10707;font-weight:700;text-decoration:none">Facebook</a> and <a href="${INSTAGRAM_URL}" style="color:#b10707;font-weight:700;text-decoration:none">Instagram</a> for trail photos, Moab adventures, and the latest from Epic.
            </p>
            <p style="margin:0 0 8px;font-size:16px;line-height:1.65;color:#3a3a3a">
              Thank you again for choosing Epic 4X4 Adventures. We hope this won’t be your last adventure with us, and we’d love to welcome you back to Moab someday.
            </p>
          </div>
          <div style="border-top:3px solid #b10707;padding:18px 30px 22px;text-align:center;font-size:12px;line-height:1.6;color:#6b7280">
            <strong style="color:#202733">Epic 4X4 Adventures</strong><br />
            435-220-2700 &nbsp;•&nbsp; Moab, Utah 84532
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendPostVisitEmail(input: {
  email: string;
  signerName: string;
  businessLine: "tour" | "rental";
  sendMode: "review_request" | "thank_you_only";
  confirmationCode: string;
  recipientKey: string;
}) {
  const resend = new Resend(requiredEnv("RESEND_API_KEY"));
  const html = renderPostVisitEmailHtml(input);

  const { data, error } = await resend.emails.send(
    {
      from: requiredEnv("GUEST_EMAIL_FROM"),
      to: input.email,
      replyTo: process.env.GUEST_EMAIL_REPLY_TO?.trim() || undefined,
      subject: "Thank you for choosing Epic 4X4 Adventures",
      html,
    },
    { idempotencyKey: `post-visit/${input.confirmationCode}/${input.recipientKey}` },
  );

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Resend did not return a message ID.");
  return { messageId: data.id };
}
