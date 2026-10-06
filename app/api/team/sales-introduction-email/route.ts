import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

const TEMPLATE_ALIAS = "abandoned-cart-rep-introduction";
const REPLY_TO = "hello@epic4x4adventures.com";

const REP_AVAILABILITY: Record<string, string> = {
  "Price Baker": "My office hours are Monday through Thursday, 8:00 AM–6:00 PM Mountain Time.",
  "Lonnie Laidman": "My office hours are Thursday through Sunday, 8:00 AM–6:00 PM Mountain Time.",
  "Kim Halls": "My office hours are Wednesday through Saturday, 8:00 AM–6:00 PM Mountain Time.",
  "Jenna McAllister": "My office hours are Sunday through Wednesday, 8:00 AM–6:00 PM Mountain Time.",
};

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...serverSupabaseHeaders(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

function firstName(value: string | null | undefined) {
  return (value || "").trim().split(/\s+/)[0] || "there";
}

function formatActivityDate(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

type Opportunity = {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone_e164: string | null;
  status: string | null;
  claimed_by_profile_id: string | null;
  claimed_by_name: string | null;
};

type OpportunityDraftLink = { draft_id: string };

type SalesDraft = {
  id: string;
  confirmation_code: string | null;
  experience_name: string | null;
  option_name: string | null;
  activity_date: string | null;
  value_cents: number | null;
  last_seen_at: string | null;
  is_current_draft: boolean | null;
  converted_at: string | null;
  last_trip_status: string | null;
};

function experienceDescription(draft: SalesDraft) {
  const parts = [draft.option_name, draft.experience_name].filter(Boolean) as string[];
  const base = parts.length ? Array.from(new Set(parts)).join(" ") : "an Epic 4X4 adventure";
  const date = formatActivityDate(draft.activity_date);
  return date ? `${base} for ${date}` : base;
}

export async function POST(request: NextRequest) {
  const accessToken = bearerToken(request);
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    opportunity_id?: string;
    personal_message?: string;
  } | null;

  const opportunityId = payload?.opportunity_id?.trim() || "";
  const personalMessage = payload?.personal_message?.trim() || "";
  if (!opportunityId) return NextResponse.json({ error: "Sales opportunity is required." }, { status: 400 });
  if (personalMessage.length > 4000) return NextResponse.json({ error: "Personal note is too long." }, { status: 400 });

  try {
    const opportunities = await rest<Opportunity[]>(
      `sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}&select=id,customer_name,email,phone_e164,status,claimed_by_profile_id,claimed_by_name&limit=1`,
    );
    const opportunity = opportunities[0];
    if (!opportunity) return NextResponse.json({ error: "Sales opportunity not found." }, { status: 404 });
    if (opportunity.claimed_by_profile_id !== profile.id) {
      return NextResponse.json({ error: "This lead must be claimed by you before you can send the introduction." }, { status: 403 });
    }
    if (!opportunity.email?.includes("@")) {
      return NextResponse.json({ error: "This lead does not have a valid email address." }, { status: 409 });
    }

    const links = await rest<OpportunityDraftLink[]>(
      `sales_opportunity_drafts?opportunity_id=eq.${encodeURIComponent(opportunityId)}&select=draft_id`,
    );
    const draftIds = links.map((row) => row.draft_id).filter(Boolean);
    if (!draftIds.length) {
      return NextResponse.json({ error: "No active TripWorks draft is linked to this lead." }, { status: 409 });
    }

    const quoted = draftIds.map((id) => `"${id.replaceAll('"', "")}"`).join(",");
    const drafts = await rest<SalesDraft[]>(
      `sales_drafts?id=in.(${encodeURIComponent(quoted)})&is_current_draft=eq.true&converted_at=is.null&select=id,confirmation_code,experience_name,option_name,activity_date,value_cents,last_seen_at,is_current_draft,converted_at,last_trip_status&order=value_cents.desc.nullslast,last_seen_at.desc.nullslast`,
    );
    const draft = drafts.find((row) => row.confirmation_code && row.last_trip_status !== "converted");
    if (!draft?.confirmation_code) {
      return NextResponse.json({ error: "No current unconverted TripWorks draft is available for this lead." }, { status: 409 });
    }

    const bookingUrl = `https://epic4x4.tripworks.com/widgets/tripBuilder?trip=${encodeURIComponent(draft.confirmation_code)}`;
    const callAvailability = REP_AVAILABILITY[profile.display_name] || "Call us during regular business hours and ask for me.";
    const senderFirstName = firstName(profile.display_name);
    const guestFirstName = firstName(opportunity.customer_name);
    const experience = experienceDescription(draft);

    const resend = new Resend(requiredEnv("RESEND_API_KEY"));
    const { data, error } = await resend.emails.send({
      from: requiredEnv("GUEST_EMAIL_FROM"),
      to: opportunity.email.trim().toLowerCase(),
      replyTo: REPLY_TO,
      template: {
        id: TEMPLATE_ALIAS,
        variables: {
          GUEST_NAME: guestFirstName,
          REP_FIRST_NAME: senderFirstName,
          EXPERIENCE_DESCRIPTION: experience,
          PERSONAL_MESSAGE: personalMessage,
          CALL_AVAILABILITY: callAvailability,
          BOOKING_URL: bookingUrl,
        },
      },
    }, { idempotencyKey: `sales-introduction-${opportunity.id}` });

    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Resend did not return a message ID.");

    const now = new Date().toISOString();
    const bodyText = [
      `Hi ${guestFirstName},`,
      "Thank you for visiting our website and considering Epic 4X4 Adventures for your time in Moab.",
      `I’m ${senderFirstName} with Epic. You were considering ${experience}, and I’d be happy to personally help you finalize your plans.`,
      "I can help with choosing the right vehicle or experience, how much time to allow, trail options, planning for your group, or any other questions you have about exploring Moab. If you’re not quite sure which option is the best fit, that’s exactly what I’m here for.",
      personalMessage,
      "I’ve also included a link to help you pick up where you left off if you prefer our 24/7 self-service online booking.",
      bookingUrl,
      callAvailability,
      "If you don’t reach me, anyone on our team will be happy to help you with your plans.",
    ].filter(Boolean).join("\n\n");

    await rest("gmail_messages", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        mailbox_email: REPLY_TO,
        gmail_message_id: data.id,
        gmail_thread_id: null,
        direction: "outbound",
        from_email: requiredEnv("GUEST_EMAIL_FROM"),
        to_emails: [opportunity.email.trim().toLowerCase()],
        subject: "Happy to help with your Moab plans",
        body_text: bodyText,
        sent_at: now,
        matched_sales_opportunity_id: opportunity.id,
        match_method: "resend_sales_introduction",
        match_confidence: "high",
        contact_name: opportunity.customer_name,
        contact_email: opportunity.email.trim().toLowerCase(),
        contact_phone: opportunity.phone_e164,
        source_type: "sales_introduction",
        updated_at: now,
      }),
    });

    return NextResponse.json({
      ok: true,
      provider_message_id: data.id,
      recipient: opportunity.email.trim().toLowerCase(),
      booking_url: bookingUrl,
      call_availability: callAvailability,
      experience_description: experience,
      sent_by: profile.display_name,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send introduction email." }, { status: 500 });
  }
}
