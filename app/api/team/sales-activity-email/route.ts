import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

const TEMPLATE_ALIAS = "abandoned-cart-activity-information";
const REPLY_TO = "hello@epic4x4adventures.com";

const REP_AVAILABILITY: Record<string, string> = {
  "Price Baker": "My office hours are Monday through Thursday, 8:00 AM–6:00 PM Mountain Time.",
  "Lonnie Laidman": "My office hours are Thursday through Sunday, 8:00 AM–6:00 PM Mountain Time.",
  "Kim Halls": "My office hours are Wednesday through Saturday, 8:00 AM–6:00 PM Mountain Time.",
  "Jenna McAllister": "My office hours are Sunday through Wednesday, 8:00 AM–6:00 PM Mountain Time.",
};

const ACTIVITY_LIBRARY = {
  hells_revenge: {
    name: "Hell’s Revenge",
    overview: "Hell’s Revenge is one of Moab’s signature slickrock experiences. It combines dramatic scenery with the kind of terrain that makes Moab famous, while your Epic guide helps the group understand what is ahead and how to approach it.",
    guidance: "It is a great choice for guests who want an unmistakably Moab experience and more excitement than a simple scenic drive. If you tell me a little about your group and comfort level, I can also help you decide which Hell’s Revenge option is the best fit.",
  },
  poison_spider: {
    name: "Poison Spider Mesa",
    overview: "Poison Spider Mesa combines classic Moab scenery with a longer, more varied trail experience. It is a strong choice for guests who want more time on trail and a mix of scenery, slickrock, and off-road terrain.",
    guidance: "If your group is deciding between Poison Spider and another Epic experience, I can help compare the time commitment, driving experience, and overall feel so you can choose confidently.",
  },
  works_sampler: {
    name: "The Works – Moab Sampler",
    overview: "The Works is designed for guests who want a broader taste of what makes off-roading in Moab special. It gives you variety in a single experience rather than focusing on only one trail personality.",
    guidance: "It is especially useful when your group wants a well-rounded Moab adventure or when you are not sure which single trail experience best matches everyone. I’m happy to talk through the differences with you.",
  },
  rental_rzr: {
    name: "Polaris RZR Rental",
    overview: "An Epic RZR rental gives you the flexibility to explore Moab on your own schedule in a premium current-model vehicle, with Epic’s local team available to help you plan the right riding area and make the most of your time.",
    guidance: "If you tell me how many people are riding, how long you want to be out, and the type of terrain you want to experience, I can help match the vehicle and rental duration to your plans.",
  },
  xpedition: {
    name: "Polaris Xpedition ADV 5 Northstar",
    overview: "The Xpedition is a strong choice for groups that want a more enclosed, comfortable way to explore while still having serious off-road capability. It is especially appealing when comfort and weather protection matter as much as trail access.",
    guidance: "I can help you compare the Xpedition with a RZR based on your group size, the season, the type of driving you want, and how much time you plan to spend on trail.",
  },
} as const;

type ActivityKey = keyof typeof ACTIVITY_LIBRARY;

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

type Opportunity = {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone_e164: string | null;
  claimed_by_profile_id: string | null;
};

type OpportunityDraftLink = { draft_id: string };

type Draft = {
  id: string;
  confirmation_code: string | null;
  is_current_draft: boolean | null;
  converted_at: string | null;
  last_trip_status: string | null;
  value_cents: number | null;
  last_seen_at: string | null;
};

export async function GET() {
  return NextResponse.json({
    activities: Object.entries(ACTIVITY_LIBRARY).map(([key, value]) => ({
      key,
      name: value.name,
      overview: value.overview,
      guidance: value.guidance,
    })),
  });
}

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(bearerToken(request));
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    opportunity_id?: string;
    activity_key?: string;
    personal_message?: string;
  } | null;

  const opportunityId = payload?.opportunity_id?.trim() || "";
  const activityKey = payload?.activity_key?.trim() as ActivityKey | undefined;
  const personalMessage = payload?.personal_message?.trim() || "";
  if (!opportunityId) return NextResponse.json({ error: "Sales opportunity is required." }, { status: 400 });
  if (!activityKey || !(activityKey in ACTIVITY_LIBRARY)) {
    return NextResponse.json({ error: "Choose an approved activity email." }, { status: 400 });
  }
  if (personalMessage.length > 4000) return NextResponse.json({ error: "Personal note is too long." }, { status: 400 });

  try {
    const opportunities = await rest<Opportunity[]>(
      `sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}&select=id,customer_name,email,phone_e164,claimed_by_profile_id&limit=1`,
    );
    const opportunity = opportunities[0];
    if (!opportunity) return NextResponse.json({ error: "Sales opportunity not found." }, { status: 404 });
    if (opportunity.claimed_by_profile_id !== profile.id) {
      return NextResponse.json({ error: "This lead must be claimed by you before you can send activity information." }, { status: 403 });
    }
    if (!opportunity.email?.includes("@")) {
      return NextResponse.json({ error: "This lead does not have a valid email address." }, { status: 409 });
    }

    const normalizedEmail = opportunity.email.trim().toLowerCase();
    const suppressions = await rest<Array<{ reason: string }>>(
      `sales_email_suppressions?email=eq.${encodeURIComponent(normalizedEmail)}&active=eq.true&select=reason&limit=1`,
    );
    if (suppressions[0]) {
      const reason = suppressions[0].reason;
      const message = reason === "complaint"
        ? "This guest marked an Epic email as spam."
        : reason === "unsubscribe"
          ? "This guest unsubscribed from sales emails."
          : "This email address is suppressed.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const links = await rest<OpportunityDraftLink[]>(
      `sales_opportunity_drafts?opportunity_id=eq.${encodeURIComponent(opportunityId)}&select=draft_id`,
    );
    const draftIds = links.map((row) => row.draft_id).filter(Boolean);
    if (!draftIds.length) {
      return NextResponse.json({ error: "No active TripWorks draft is linked to this lead." }, { status: 409 });
    }
    const quoted = draftIds.map((id) => `"${id.replaceAll('"', "")}"`).join(",");
    const drafts = await rest<Draft[]>(
      `sales_drafts?id=in.(${encodeURIComponent(quoted)})&is_current_draft=eq.true&converted_at=is.null&select=id,confirmation_code,is_current_draft,converted_at,last_trip_status,value_cents,last_seen_at&order=value_cents.desc.nullslast,last_seen_at.desc.nullslast`,
    );
    const draft = drafts.find((row) => row.confirmation_code && row.last_trip_status !== "converted");
    if (!draft?.confirmation_code) {
      return NextResponse.json({ error: "No current unconverted TripWorks draft is available for this lead." }, { status: 409 });
    }

    const activity = ACTIVITY_LIBRARY[activityKey];
    const bookingUrl = `https://epic4x4.tripworks.com/widgets/tripBuilder?trip=${encodeURIComponent(draft.confirmation_code)}`;
    const unsubscribeToken = randomUUID();
    await rest("sales_email_unsubscribe_tokens", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        token: unsubscribeToken,
        email: normalizedEmail,
        opportunity_id: opportunity.id,
      }),
    });
    const unsubscribeUrl = `https://www.myepicreservation.com/api/email/sales-unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    const callAvailability = REP_AVAILABILITY[profile.display_name] || "Call us during regular business hours and ask for me.";
    const senderFirstName = firstName(profile.display_name);
    const guestFirstName = firstName(opportunity.customer_name);

    const resend = new Resend(requiredEnv("RESEND_API_KEY"));
    const { data, error } = await resend.emails.send({
      from: requiredEnv("GUEST_EMAIL_FROM"),
      to: normalizedEmail,
      replyTo: REPLY_TO,
      template: {
        id: TEMPLATE_ALIAS,
        variables: {
          GUEST_NAME: guestFirstName,
          REP_FIRST_NAME: senderFirstName,
          ACTIVITY_NAME: activity.name,
          ACTIVITY_OVERVIEW: activity.overview,
          ACTIVITY_GUIDANCE: activity.guidance,
          PERSONAL_MESSAGE: personalMessage,
          CALL_AVAILABILITY: callAvailability,
          BOOKING_URL: bookingUrl,
          EPIC_UNSUBSCRIBE_URL: unsubscribeUrl,
        },
      },
    }, { idempotencyKey: `sales-activity-${activityKey}-${opportunity.id}-${new Date().toISOString().slice(0,10)}` });

    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Resend did not return a message ID.");

    const now = new Date().toISOString();
    const bodyText = [
      `Hi ${guestFirstName},`,
      `I thought I’d send a little more information about ${activity.name} since it’s one of the options you’ve been considering.`,
      activity.overview,
      activity.guidance,
      personalMessage,
      "If you’d rather keep planning on your own, you can pick up where you left off anytime.",
      bookingUrl,
      callAvailability,
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
        to_emails: [normalizedEmail],
        subject: `A little more about ${activity.name}`,
        body_text: bodyText,
        sent_at: now,
        matched_sales_opportunity_id: opportunity.id,
        match_method: `resend_sales_activity:${profile.id}`,
        match_confidence: "high",
        contact_name: opportunity.customer_name,
        contact_email: normalizedEmail,
        contact_phone: opportunity.phone_e164,
        source_type: "sales_activity_information",
        updated_at: now,
      }),
    });

    return NextResponse.json({
      ok: true,
      provider_message_id: data.id,
      activity_key: activityKey,
      activity_name: activity.name,
      recipient: normalizedEmail,
      sent_by: profile.display_name,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send activity information." }, { status: 500 });
  }
}
