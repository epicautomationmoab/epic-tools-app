"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getRecentSalesQuotes,
  getSalesExperienceFees,
  getSalesBookingLinks,
  getSalesQuoteDetail,
  getSalesRates,
  saveSalesQuote,
  type RecentSalesQuote,
  type SalesExperienceFee,
  type SalesRateRow,
} from "../lib/sales-data";

type Ticket = { id: string; name: string; price: number; note?: string };
type Experience = { id: string; name: string; line: "tour" | "rental"; tickets: Ticket[] };
type QuoteActivity = {
  key: string;
  experienceId: string;
  qty: Record<string, number>;
  tripSafe: boolean;
  premier: boolean;
  priorEveningPickup: boolean;
  nextMorningDropoff: boolean;
};

type TripWorksAvailabilityTicket = {
  customer_type?: { id?: number; name?: string; is_visible?: boolean };
  availability_cnt?: number;
  passenger_count?: number;
  hold_cnt?: number;
};

type TripWorksTimeslot = {
  id?: number;
  label?: string;
  time_label?: string;
  full_label?: string;
  start_time?: string;
  note?: string;
  capacity_cnt?: number;
  availability_cnt?: number;
  passenger_count?: number;
  experience_timeslot_status?: { name?: string; slug?: string };
  availabilities?: TripWorksAvailabilityTicket[];
};

type ActivityAvailabilityState = {
  date: string;
  loading: boolean;
  error: string;
  timeslots: TripWorksTimeslot[];
};

type PendingBooking = {
  experienceId: string;
  experienceName: string;
  date: string;
  time: string;
  total: number;
};

function collectTimeslots(value: unknown, found = new Map<string, TripWorksTimeslot>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTimeslots(item, found));
    return Array.from(found.values());
  }
  if (!value || typeof value !== "object") return Array.from(found.values());

  const record = value as Record<string, unknown>;
  const looksLikeTimeslot =
    typeof record.start_time === "string" &&
    record.experience_timeslot_status &&
    typeof record.experience_timeslot_status === "object";

  if (looksLikeTimeslot) {
    const slot = record as TripWorksTimeslot;
    const key = String(slot.id ?? slot.start_time ?? found.size);
    found.set(key, slot);
    return Array.from(found.values());
  }

  Object.values(record).forEach((item) => collectTimeslots(item, found));
  return Array.from(found.values());
}

function requestTripWorksAvailability(experienceId: string, date: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("TripWorks availability timed out. Make sure TripWorks is open, signed in, and the Epic bridge extension is installed."));
    }, 12000);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as { type?: string; requestId?: string; ok?: boolean; data?: unknown; error?: string };
      if (data?.type !== "EPIC_TW_AVAILABILITY_RESPONSE" || data.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      if (data.ok) resolve(data.data);
      else reject(new Error(data.error || "TripWorks availability request failed."));
    }

    window.addEventListener("message", onMessage);
    window.postMessage({
      type: "EPIC_TW_AVAILABILITY_REQUEST",
      requestId,
      experienceId,
      date,
    }, "*");
  });
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function ticketSortRank(name: string) {
  const value = name.toLowerCase();
  if (value.includes("3 hour")) return 10;
  if (value.includes("5 hour") || value.includes("half-day") || value.includes("half day")) return 20;
  if (value.includes("9 hour") || value.includes("full-day") || value.includes("full day")) return 30;
  if (value.includes("24 hour")) return 40;
  const dayMatch = value.match(/(\d+)\s*[- ]?day/);
  if (dayMatch) return 40 + Number(dayMatch[1]) * 10;
  if (value.includes("vehicle") || value.includes("rzr") || value.includes("pro r") || value.includes("pro s") || value.includes("xpedition")) return 100;
  if (value.includes("guide car")) return 210;
  return 500;
}

function rentalDaysFromTicket(name: string) {
  const value = name.toLowerCase();
  const dayMatch = value.match(/(\d+)\s*[- ]?day/);
  return dayMatch ? Number(dayMatch[1]) : 1;
}

function normalizeAvailabilityName(value: string) {
  return value.toLowerCase().replace(/2025|2026/g, "").replace(/polaris|rzr|ultimate|xp5|xp|1000/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function matchingAvailability(slot: TripWorksTimeslot, ticket: Ticket) {
  const normalizedTicket = normalizeAvailabilityName(ticket.name);
  return (slot.availabilities || []).find((item) => {
    const candidate = normalizeAvailabilityName(item.customer_type?.name || "");
    if (!candidate) return false;
    return candidate === normalizedTicket || candidate.includes(normalizedTicket) || normalizedTicket.includes(candidate);
  });
}

function isGatewaySharedVehicleExperience(experience: Experience) {
  return experience.name.toLowerCase().includes("gateway to hell's revenge and fins n' things");
}

function isGatewayVehicleTicket(ticket: Ticket) {
  const value = ticket.name.toLowerCase();
  return value.includes("vehicle") || value.includes("rzr 1000 for 1 - 2 people") || value.includes("rzr 1000 for 3 - 4 people");
}

function gatewaySelectedVehicleCount(activity: QuoteActivity, experience: Experience) {
  return experience.tickets.reduce((total, ticket) => {
    if (!isGatewayVehicleTicket(ticket)) return total;
    return total + (activity.qty[ticket.id] ?? 0);
  }, 0);
}

function buildExperiences(rows: SalesRateRow[]): Experience[] {
  const grouped = new Map<string, Experience>();
  for (const row of rows) {
    const line: "tour" | "rental" = row.business_line === "rental" ? "rental" : "tour";
    if (!grouped.has(row.experience_id)) {
      grouped.set(row.experience_id, {
        id: row.experience_id,
        name: row.experience_name || `Experience ${row.experience_id}`,
        line,
        tickets: [],
      });
    }
    grouped.get(row.experience_id)!.tickets.push({
      id: row.ticket_type_id,
      name: row.effective_start?.startsWith("2027") ? row.ticket_type_name.replace(/2026/g, "2027") : row.ticket_type_name,
      price: row.unit_price_cents / 100,
      note: row.sales_help_text || row.quantity_label || "Sales rate",
    });
  }

  for (const experience of grouped.values()) {
    experience.tickets.sort((a, b) => {
      const rank = ticketSortRank(a.name) - ticketSortRank(b.name);
      return rank || a.name.localeCompare(b.name);
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.line !== b.line) return a.line === "tour" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function blankActivity(experienceId = ""): QuoteActivity {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    experienceId,
    qty: {},
    tripSafe: false,
    premier: false,
    priorEveningPickup: false,
    nextMorningDropoff: false,
  };
}

function quoteName(quote: RecentSalesQuote) {
  return quote.customer_name || quote.customer_email || quote.customer_phone_e164 || `Quote ${quote.quote_id.slice(0, 8)}`;
}

function dateRange(quote: RecentSalesQuote) {
  if (!quote.visit_start_date) return "Dates not set";
  if (!quote.visit_end_date || quote.visit_end_date === quote.visit_start_date) return quote.visit_start_date;
  return `${quote.visit_start_date} to ${quote.visit_end_date}`;
}

export default function QuoteBuilder() {
  const [active, setActive] = useState<"leads" | "quotes">("quotes");
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [pricingYear, setPricingYear] = useState<2026 | 2027>(2026);
  const [seasonReady, setSeasonReady] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [pendingSeason, setPendingSeason] = useState<2026 | 2027 | null>(null);
  const [experienceFees, setExperienceFees] = useState<SalesExperienceFee[]>([]);
  const [bookingLinks, setBookingLinks] = useState<Record<string, string>>({});
  const [activities, setActivities] = useState<QuoteActivity[]>([blankActivity()]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [visitStart, setVisitStart] = useState("");
  const [visitEnd, setVisitEnd] = useState("");
  const [recentQuotes, setRecentQuotes] = useState<RecentSalesQuote[]>([]);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [availabilityDates, setAvailabilityDates] = useState<Record<string, string>>({});
  const [availabilityByActivity, setAvailabilityByActivity] = useState<Record<string, ActivityAvailabilityState>>({});
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerQuery = new URLSearchParams();
    const contact = params.get("contact");
    const opportunity = params.get("opportunity");
    const reservation = params.get("reservation");
    const quote = params.get("quote");
    if (contact) customerQuery.set("contact", contact);
    if (opportunity) customerQuery.set("opportunity", opportunity);
    if (reservation) customerQuery.set("reservation", reservation);
    if (customerQuery.size) {
      fetch(`/api/sales/customer-360?${customerQuery.toString()}`, { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.error || "Unable to load customer details.");
          return payload?.customer || null;
        })
        .then((customer) => {
          if (!customer?.identity) return;
          setName(String(customer.identity.name || ""));
          setEmail(String(customer.identity.email || ""));
          setPhone(String(customer.identity.phone || ""));
        })
        .catch((err) => setSaveMessage(err instanceof Error ? err.message : "Unable to load customer details."));
    }

    Promise.all([getSalesRates(2026), getSalesExperienceFees(), getSalesBookingLinks()])
      .then(([rows, fees, links]) => {
        const built = buildExperiences(rows);
        setExperiences(built);
        setExperienceFees(fees);
        setBookingLinks(Object.fromEntries(links.map((link) => [link.experience_id, link.booking_url])));
        setActivities([blankActivity()]);
        if (quote) void openQuote(quote);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load sales pricing"))
      .finally(() => setLoading(false));

    getRecentSalesQuotes().then(setRecentQuotes).catch(() => undefined);
  }, []);

  async function changePricingYear(year: 2026 | 2027) {
    if (year === pricingYear || seasonLoading) return;
    setSeasonLoading(true);
    setSaveMessage("");
    try {
      const rows = await getSalesRates(year);
      if (!rows.length) throw new Error(`No ${year} rates are available. The current quote has not been changed.`);
      setExperiences(buildExperiences(rows));
      setPricingYear(year);
      setSeasonReady(true);
      // Switching seasons starts a fresh quote. Never retain cross-season dates,
      // quantities, availability, contact details or an old saved quote identifier.
      setEditingQuoteId(null);
      setActivities([blankActivity()]);
      setVisitStart("");
      setVisitEnd("");
      setAvailabilityDates({});
      setAvailabilityByActivity({});
      setPendingBooking(null);
      setName("");
      setEmail("");
      setPhone("");
      setDetailsOpen(false);
      setError("");
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Unable to load seasonal pricing.");
    } finally {
      setSeasonLoading(false);
    }
  }

  const effectiveVisitStart = visitStart || Object.values(availabilityDates).find(Boolean) || "";
  const dateSeasonMismatch = [visitStart, visitEnd, ...Object.values(availabilityDates)]
    .filter(Boolean).some(date => /^20\\d{2}-/.test(date) && Number(date.slice(0,4)) !== pricingYear);

  const pending2027: Record<string, string> = {
    "13804": "2027 Poison Spider pricing coming soon. We're building our 2027 Poison Spider calendar and will get back to the guest promptly.",
    "16190": "2027 Poison Spider pricing coming soon. We're building our 2027 Poison Spider calendar and will get back to the guest promptly."
  };
  const unavailable2027Options = [
    {id:"16190", name:"Poison Spider Mesa Tour — 2027 pricing coming soon"}
  ];

  function updateActivity(key: string, changes: Partial<QuoteActivity>) {
    setActivities((current) => current.map((item) => item.key === key ? { ...item, ...changes } : item));
  }

  function changeExperience(key: string, experienceId: string) {
    updateActivity(key, { experienceId, qty: {}, tripSafe: false, premier: false, priorEveningPickup: false, nextMorningDropoff: false });
  }

  function changeQty(activityKey: string, ticketId: string, delta: number) {
    setActivities((current) => current.map((item) => {
      if (item.key !== activityKey) return item;
      return { ...item, qty: { ...item.qty, [ticketId]: Math.max(0, (item.qty[ticketId] ?? 0) + delta) } };
    }));
  }

  function addActivity() {
    setActivities((current) => [...current, blankActivity()]);
  }

  function removeActivity(key: string) {
    setActivities((current) => current.filter((item) => item.key !== key));
    setAvailabilityDates((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setAvailabilityByActivity((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function openQuoteBookingCard(quoteId: string, booking: PendingBooking) {
    const detail = await getSalesQuoteDetail(quoteId);
    const savedActivity = detail.activities.find((item) => item.experience_id === booking.experienceId);
    if (!savedActivity) throw new Error("Saved quote activity could not be found.");

    const q = detail.quote;
    const savedActivityTotal = Number((savedActivity as unknown as { total_cents?: number }).total_cents);
    let twCustomerCode = "";
    // Use the C360 identity match for this quote, never a similarly named customer.
    if(q.opportunity_id){
      try{
        const response=await fetch(`/api/sales/customer-360?opportunity=${encodeURIComponent(String(q.opportunity_id))}`,{cache:"no-store"});
        if(response.ok){
          const result=await response.json();
          const identity=result?.customer?.identity;
          const sameEmail=Boolean(q.customer_email)&&String(identity?.email||"").toLowerCase()===String(q.customer_email).toLowerCase();
          const samePhone=Boolean(q.customer_phone_e164)&&String(identity?.phone||"").replace(/\D/g,"")===String(q.customer_phone_e164).replace(/\D/g,"");
          if(sameEmail||samePhone)twCustomerCode=String(identity?.tripworks_customer_code||"");
        }
      }catch{ /* Still open the booking helper when identity lookup is unavailable. */ }
    }
    const params = new URLSearchParams({
      source: "quote",
      quote: quoteId,
      customer: String(q.customer_name || ""),
      email: String(q.customer_email || ""),
      phone: String(q.customer_phone_e164 || ""),
      twcustomer: twCustomerCode,
      experience: savedActivity.experience_name || booking.experienceName,
      date: booking.date,
      time: booking.time,
      total: String(Number.isFinite(savedActivityTotal) ? savedActivityTotal : Math.round(booking.total * 100)),
      tickets: JSON.stringify(savedActivity.items
        .filter((item) => item.quantity > 0)
        .map((item) => ({ name: item.ticket_type_name, quantity: item.quantity }))),
      tripsafe: savedActivity.tripsafe_selected ? "1" : "0",
      premier: savedActivity.premier_selected ? "1" : "0",
      priorpickup: savedActivity.prior_evening_pickup ? "1" : "0",
      nextdropoff: savedActivity.next_morning_dropoff ? "1" : "0",
    });
    const helperUrl = `/sales/quote-booking-helper?${params.toString()}`;

    const pictureInPicture = (window as any).documentPictureInPicture;
    if (pictureInPicture?.requestWindow) {
      try {
        const pipWindow = await pictureInPicture.requestWindow({ width: 430, height: 760 });
        pipWindow.document.title = "Epic Staff Booking";
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.style.overflow = "hidden";
        const frame = pipWindow.document.createElement("iframe");
        frame.src = helperUrl;
        frame.title = "Epic Staff Booking";
        frame.style.width = "100%";
        frame.style.height = "100vh";
        frame.style.border = "0";
        frame.style.display = "block";
        pipWindow.document.body.appendChild(frame);
      } catch {
        window.open(helperUrl, "epic-staff-booking", "popup=yes,width=680,height=860,resizable=yes,scrollbars=yes");
      }
    } else {
      window.open(helperUrl, "epic-staff-booking", "popup=yes,width=680,height=860,resizable=yes,scrollbars=yes");
    }

    window.open("https://epic4x4.tripworks.com/trips", "_blank");
  }

  function beginBooking(booking: PendingBooking) {
    setPendingBooking(booking);
    setDetailsOpen(true);
  }

  function beginQuoteBookingFromDetails() {
    const bookable = calculatedActivities.filter((item) =>
      item.experience && Object.values(item.activity.qty).some((quantity) => quantity > 0)
    );
    if (bookable.length !== 1) {
      setSaveMessage(bookable.length > 1
        ? "This quote has multiple activities. Use Book It on the availability card for the activity you want to book first."
        : "Add at least one ticket before booking.");
      return;
    }
    const item = bookable[0];
    const availability = availabilityByActivity[item.activity.key];
    const openSlots = availability?.timeslots.filter((slot) => {
      const status = slot.experience_timeslot_status?.name || "";
      return slot.experience_timeslot_status?.slug === "open" || status.toLowerCase() === "open";
    }) || [];
    const onlyOpenSlot = openSlots.length === 1 ? openSlots[0] : null;
    setPendingBooking({
      experienceId: item.experience!.id,
      experienceName: item.experience!.name,
      date: availability?.date || availabilityDates[item.activity.key] || visitStart,
      time: onlyOpenSlot ? (onlyOpenSlot.time_label || onlyOpenSlot.label || onlyOpenSlot.full_label || onlyOpenSlot.start_time || "") : "",
      total: item.total,
    });
  }

  async function checkAvailability(activityKey: string, experienceId: string) {
    const experience = experiences.find((item) => item.id === experienceId);
    const activity = activities.find((item) => item.key === activityKey);
    if (experience?.line === "rental" && (!activity || !Object.values(activity.qty).some((quantity) => quantity > 0))) {
      setAvailabilityByActivity((current) => ({
        ...current,
        [activityKey]: { date: availabilityDates[activityKey] || visitStart, loading: false, error: "Choose the rental duration and quantity first.", timeslots: [] },
      }));
      return;
    }

    const date = availabilityDates[activityKey] || visitStart;
    if (!date) {
      setAvailabilityByActivity((current) => ({
        ...current,
        [activityKey]: { date: "", loading: false, error: "Choose a date first.", timeslots: [] },
      }));
      return;
    }

    setAvailabilityByActivity((current) => ({
      ...current,
      [activityKey]: { date, loading: true, error: "", timeslots: current[activityKey]?.timeslots || [] },
    }));

    try {
      const payload = await requestTripWorksAvailability(experienceId, date);
      const timeslots = collectTimeslots(payload).sort((a, b) =>
        String(a.start_time || a.time_label || "").localeCompare(String(b.start_time || b.time_label || ""))
      );
      setAvailabilityByActivity((current) => ({
        ...current,
        [activityKey]: {
          date,
          loading: false,
          error: timeslots.length ? "" : "TripWorks returned no timeslots for this date.",
          timeslots,
        },
      }));
    } catch (err) {
      setAvailabilityByActivity((current) => ({
        ...current,
        [activityKey]: {
          date,
          loading: false,
          error: err instanceof Error ? err.message : "Unable to load TripWorks availability.",
          timeslots: [],
        },
      }));
    }
  }

  function newQuote() {
    setEditingQuoteId(null);
    setActivities([blankActivity()]);
    setName("");
    setEmail("");
    setPhone("");
    setVisitStart("");
    setVisitEnd("");
    setDetailsOpen(false);
    setSaveMessage("");
    setAvailabilityDates({});
    setAvailabilityByActivity({});
    setPendingBooking(null);
    setActive("quotes");
    window.history.replaceState({}, "", window.location.pathname);
  }

  async function openQuote(quoteId: string) {
    setOpening(true);
    setSaveMessage("");
    try {
      const detail = await getSalesQuoteDetail(quoteId);
      const q = detail.quote;
      setEditingQuoteId(quoteId);
      setName(String(q.customer_name || ""));
      setEmail(String(q.customer_email || ""));
      setPhone(String(q.customer_phone_e164 || ""));
      setVisitStart(String(q.visit_start_date || ""));
      if (String(q.visit_start_date || "").startsWith("2027-")) {
        const seasonal = await getSalesRates(2027);
        setExperiences(buildExperiences(seasonal));
        setPricingYear(2027);
      } else {
        setExperiences(buildExperiences(await getSalesRates(2026)));
        setPricingYear(2026);
      }
      setVisitEnd(String(q.visit_end_date || ""));
      setActivities(detail.activities.map((activity) => ({
        key: activity.id,
        experienceId: activity.experience_id,
        tripSafe: activity.tripsafe_selected,
        premier: activity.premier_selected,
        priorEveningPickup: Boolean(activity.prior_evening_pickup),
        nextMorningDropoff: Boolean(activity.next_morning_dropoff),
        qty: Object.fromEntries(activity.items.map((item) => [item.ticket_type_id, item.quantity])),
      })));
      setAvailabilityDates(Object.fromEntries(detail.activities.map((activity) => [activity.id, String(q.visit_start_date || "")])));
      setAvailabilityByActivity({});
      window.history.replaceState({}, "", `/sales/quote?quote=${encodeURIComponent(quoteId)}`);
      setActive("quotes");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Unable to open quote.");
    } finally {
      setOpening(false);
    }
  }

  const calculatedActivities = useMemo(() => activities.map((activity) => {
    const experience = experiences.find((item) => item.id === activity.experienceId);
    const privateFeeRule = experienceFees.find((fee) => fee.experience_id === activity.experienceId);
    const privateFee = privateFeeRule ? privateFeeRule.fee_cents / 100 : 0;
    const subtotal = experience ? experience.tickets.reduce((sum, ticket) => sum + ticket.price * (activity.qty[ticket.id] ?? 0), 0) : 0;
    const overnightAmount = experience?.line === "rental" ? (Number(activity.priorEveningPickup) + Number(activity.nextMorningDropoff)) * 50 : 0;
    const pricingBase = subtotal + privateFee + overnightAmount;
    const tripSafeAmount = activity.tripSafe ? pricingBase * 0.09 : 0;
    let rentalDays = 1;
    if (experience?.line === "rental") {
      rentalDays = experience.tickets.reduce((maxDays, ticket) => {
        return (activity.qty[ticket.id] ?? 0) > 0 ? Math.max(maxDays, rentalDaysFromTicket(ticket.name)) : maxDays;
      }, 1);
    }
    const rentalVehicleCount = experience?.line === "rental"
      ? experience.tickets.reduce((sum, ticket) => sum + (activity.qty[ticket.id] ?? 0), 0)
      : 0;
    const premierAmount = experience?.line === "rental" && activity.premier ? 69 * rentalDays * rentalVehicleCount : 0;
    const primaryTax = experience?.line === "rental"
      ? (pricingBase + premierAmount) * 0.0635
      : pricingBase * 0.0735;
    const secondaryTax = experience?.line === "rental" ? pricingBase * 0.025 : 0;
    const twBase = pricingBase + primaryTax + secondaryTax + tripSafeAmount + premierAmount;
    const twFee = twBase * 0.04;
    const total = twBase + twFee;
    return {
      activity,
      experience,
      privateFeeRule,
      privateFee,
      overnightAmount,
      subtotal,
      primaryTax,
      secondaryTax,
      tripSafeAmount,
      premierAmount,
      rentalDays,
      rentalVehicleCount,
      twFee,
      total,
    };
  }), [activities, experiences, experienceFees]);

  const totals = calculatedActivities.reduce((sum, item) => ({
    subtotal: sum.subtotal + item.subtotal,
    privateFees: sum.privateFees + item.privateFee,
    tax: sum.tax + item.primaryTax + item.secondaryTax,
    tripSafe: sum.tripSafe + item.tripSafeAmount,
    premier: sum.premier + item.premierAmount,
    twFee: sum.twFee + item.twFee,
    total: sum.total + item.total,
  }), { subtotal: 0, privateFees: 0, tax: 0, tripSafe: 0, premier: 0, twFee: 0, total: 0 });

  const hasAnyTicket = activities.some((activity) => Object.values(activity.qty).some((quantity) => quantity > 0));

  async function handleSave() {
    if (seasonLoading || !seasonReady || dateSeasonMismatch || (pricingYear === 2027 && !effectiveVisitStart.startsWith("2027-")) || activities.some(a => Boolean(pending2027[a.experienceId]))) {
      setSaveMessage("Set the matching 2027 visit date and select an activity with published pricing before saving.");
      return;
    }
    if (!hasAnyTicket) {
      setSaveMessage("Add at least one ticket before saving the estimate.");
      return;
    }
    if (pendingBooking && !name.trim()) {
      setSaveMessage("Add the guest name before booking.");
      return;
    }
    setSaving(true);
    setSaveMessage("");
    try {
      const result = await saveSalesQuote({
        quoteId: editingQuoteId,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        visitStart,
        visitEnd,
        activities: activities.map((activity) => ({
          experienceId: activity.experienceId,
          tripSafe: activity.tripSafe,
          premier: activity.premier,
          priorEveningPickup: activity.priorEveningPickup,
          nextMorningDropoff: activity.nextMorningDropoff,
          tickets: Object.entries(activity.qty)
            .filter(([, quantity]) => quantity > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        })),
      });
      setEditingQuoteId(result.quote_id);
      setDetailsOpen(false);
      getRecentSalesQuotes().then(setRecentQuotes).catch(() => undefined);

      if (pendingBooking) {
        const booking = pendingBooking;
        setPendingBooking(null);
        await openQuoteBookingCard(result.quote_id, booking);
        setSaveMessage(`Quote ${result.quote_id.slice(0, 8)} saved and ready to book.`);
        return;
      }

      const customerSearch = phone.trim() || email.trim();
      if (customerSearch) {
        window.location.href = `/sales/customers?q=${encodeURIComponent(customerSearch)}&open=1`;
        return;
      }
      window.history.replaceState({}, "", `/sales/quote?quote=${encodeURIComponent(result.quote_id)}`);
      setSaveMessage(`Quote ${result.quote_id.slice(0, 8)} saved. You can reopen it from Saved Quotes. Add an email or phone to connect it to C360.`);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Unable to save estimate.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndEmail() {
    if (seasonLoading || !seasonReady || dateSeasonMismatch || (pricingYear === 2027 && !effectiveVisitStart.startsWith("2027-")) || activities.some(a => Boolean(pending2027[a.experienceId]))) {
      setSaveMessage("Set the matching 2027 visit date and select an activity with published pricing before emailing.");
      return;
    }
    if (!email.trim()) { setSaveMessage("Add a guest email before sending the quote."); return; }
    if (!hasAnyTicket) { setSaveMessage("Add at least one ticket before sending the quote."); return; }
    setEmailing(true); setSaveMessage("");
    try {
      const result = await saveSalesQuote({
        quoteId: editingQuoteId, customerName: name, customerEmail: email, customerPhone: phone,
        visitStart: effectiveVisitStart, visitEnd,
        activities: activities.map((activity) => ({
          experienceId: activity.experienceId, tripSafe: activity.tripSafe, premier: activity.premier,
          priorEveningPickup: activity.priorEveningPickup, nextMorningDropoff: activity.nextMorningDropoff,
          tickets: Object.entries(activity.qty).filter(([, quantity]) => quantity > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        })),
      });
      setEditingQuoteId(result.quote_id);
      const first = name.trim().split(/\s+/)[0] || "there";
      const lines = [`Hi ${first},`, "", "I’m excited to help you plan your Moab adventure. I’ve put together the quote below based on your request."];
      for (const item of calculatedActivities) {
        if (!item.experience) continue;
        lines.push("", item.experience.name);
        for (const ticket of item.experience.tickets) {
          const qty = item.activity.qty[ticket.id] ?? 0;
          if (qty > 0) lines.push(`• ${qty} × ${ticket.name} — ${money.format(ticket.price * qty)}`);
        }
        if (item.privateFee > 0) lines.push(`• ${item.privateFeeRule?.fee_label || "Private Tour Fee"} — ${money.format(item.privateFee)}`);
        if (item.activity.tripSafe) lines.push("• TripSafe selected");
        if (item.activity.premier) lines.push("• Premier Adventure Assure selected");
        if (item.activity.priorEveningPickup) lines.push("• Prior Evening Pickup — $50.00");
        if (item.activity.nextMorningDropoff) lines.push("• Next Morning Drop-off — $50.00");
        if (calculatedActivities.filter((activity) => activity.experience).length > 1) lines.push(`Estimated activity total: ${money.format(item.total)}`);
      }
      lines.push("", `Estimated Trip Total: ${money.format(totals.total)}`, "",
        "I'll follow up as we discussed. In the meantime, please call me at 435-220-2700 if you have any questions or if you're ready to book. I'd be happy to take care of it for you.");
      const online = calculatedActivities.filter((item) => item.experience && bookingLinks[item.experience.id]);
      if (online.length) {
        lines.push("", "Prefer to book online?");
        for (const item of online) lines.push("", item.experience!.name, bookingLinks[item.experience!.id]);
        lines.push("", "Availability is not held until a reservation is completed. Online booking will let you choose from currently available dates and departure times.");
      }
      const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      const quoteCards = calculatedActivities.filter((item) => item.experience).map((item) => {
        const detailRows = item.experience!.tickets.flatMap((ticket) => {
          const qty = item.activity.qty[ticket.id] ?? 0;
          return qty > 0 ? [`<div style="padding:4px 0">• ${qty} × ${escapeHtml(ticket.name)} — ${money.format(ticket.price * qty)}</div>`] : [];
        });
        if (item.privateFee > 0) detailRows.push(`<div style="padding:4px 0">• ${escapeHtml(item.privateFeeRule?.fee_label || "Private Tour Fee")} — ${money.format(item.privateFee)}</div>`);
        if (item.activity.tripSafe) detailRows.push(`<div style="padding:4px 0">• TripSafe — ${money.format(item.tripSafeAmount)}</div>`);
        if (item.activity.premier) detailRows.push(`<div style="padding:4px 0">• Premier Adventure Assure — ${money.format(item.premierAmount)}</div>`);
        if (item.activity.priorEveningPickup) detailRows.push(`<div style="padding:4px 0">• Prior Evening Pickup — $50.00</div>`);
        if (item.activity.nextMorningDropoff) detailRows.push(`<div style="padding:4px 0">• Next Morning Drop-off — $50.00</div>`);
        detailRows.push(`<div style="padding:4px 0">• Taxes &amp; Fees — ${money.format(item.primaryTax + item.secondaryTax + item.twFee)}</div>`);
        return `<div style="margin:18px 0;padding:18px 20px;border:1px solid #e5e7eb;border-left:4px solid #d9471c;border-radius:8px;background:#ffffff"><div style="font-size:17px;font-weight:700;margin-bottom:8px">${escapeHtml(item.experience!.name)}</div>${detailRows.join("")}<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-weight:700"><span>Estimated activity total:</span><span>${money.format(item.total)}</span></div></div>`;
      }).join("");
      const onlineButtons = online.map((item) => `<div style="margin:10px 0"><a href="${escapeHtml(bookingLinks[item.experience!.id])}" style="display:inline-block;background:#d9471c;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:6px">${escapeHtml(item.experience!.name)}</a></div>`).join("");
      const messageHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:15px;line-height:1.6;max-width:680px"><div style="border-top:5px solid #d9471c;padding-top:22px"><div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#d9471c">Epic 4X4 Adventures</div><div style="font-size:26px;font-weight:700;margin:4px 0 22px">Your Moab Adventure Quote</div><p>Hi ${escapeHtml(first)},</p><p>I’m excited to help you plan your Moab adventure. I’ve put together the quote below based on your request.</p>${quoteCards}<div style="margin:22px 0;padding:16px 20px;background:#f5f5f5;border-radius:8px"><div style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Estimated Trip Total</div><div style="font-size:26px;font-weight:700">${money.format(totals.total)}</div></div><p>I’ll follow up as we discussed. In the meantime, please call me at <a href="tel:+14352202700" style="color:#d9471c;text-decoration:none;font-weight:600">435-220-2700</a> if you have any questions or if you’re ready to book. I’d be happy to take care of it for you.</p>${online.length ? `<div style="margin-top:26px"><div style="font-size:15px;font-weight:700;margin-bottom:6px">Want to learn more?</div>${onlineButtons}<p style="font-size:13px;color:#6b7280;margin-top:12px">Availability is not held until a reservation is completed. Online booking will let you choose from currently available dates and departure times.</p></div>` : ""}</div></div>`;
      const response = await fetch("/api/sales/customer-communications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email", opportunity_id: result.opportunity_id, email: email.trim(),
          customer_name: name.trim() || null, subject: "Your Epic 4X4 Adventure Quote", message_text: lines.join("\n"), message_html: messageHtml
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to send quote email.");
      setDetailsOpen(false);
      setSaveMessage(`Quote emailed to ${email.trim()}.`);
      getRecentSalesQuotes().then(setRecentQuotes).catch(() => undefined);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Unable to save and email quote.");
    } finally { setEmailing(false); }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">Epic <span>Sales</span></div>
        <nav className="nav">
          <button className={active === "leads" ? "active" : ""} onClick={() => setActive("leads")}>Leads</button>
          <button className={active === "quotes" ? "active" : ""} onClick={() => setActive("quotes")}>Quote Builder</button>
        </nav>
      </header>

      <section className="content">
        {active === "leads" ? (
          <div className="card">
            <div className="sectionHeading">
              <div><h2>Saved Quotes & Leads</h2><p className="muted compact">Open any quote to add contact info, dates, or change the estimate.</p></div>
              <button className="secondary" onClick={newQuote}>+ Build Estimate</button>
            </div>
            {recentQuotes.length === 0 ? <p className="muted">No saved quotes yet.</p> : recentQuotes.map((quote) => (
              <div className="leadRow" key={quote.quote_id}>
                <div><strong>{quoteName(quote)}</strong><div className="ticketMeta">Quote {quote.quote_id.slice(0, 8)} · {dateRange(quote)}</div></div>
                <span className="muted">{quote.opportunity_id ? "Lead attached" : "Quote only"}</span>
                <span className="badge">{quote.status}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <strong>{money.format(quote.total_cents / 100)}</strong>
                  <button className="secondary" onClick={() => openQuote(quote.quote_id)} disabled={opening}>{opening ? "Opening..." : "Open / Edit"}</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid quoteGrid">
            <section>
              <div className="sectionHeading">
                <div><h2>{editingQuoteId ? `Edit Quote ${editingQuoteId.slice(0, 8)}` : "Build Estimate"}</h2></div>
                <div style={{ display: "flex", gap: 8 }}><button className="secondary" type="button" onClick={() => setActive("leads")}>Saved Quotes</button><button className="secondary" type="button" onClick={newQuote}>+ New Quote</button></div>
              </div>
              <div className="card" style={{marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <strong>Pricing season</strong>
                  <div style={{display:"flex",gap:8}}>
                    {([2026, 2027] as const).map(year => (
                      <button key={year} type="button" disabled={seasonLoading}
                        aria-pressed={pricingYear === year}
                        className={pricingYear === year ? "primary" : "secondary"}
                        onClick={() => { if (year !== pricingYear) setPendingSeason(year); }}>
                        {year} Rates
                      </button>
                    ))}
                  </div>
                </div>
                {dateSeasonMismatch && <div className="availabilityError">The activity or visit date does not match {pricingYear} pricing. Correct the year before saving or booking.</div>}
                
                {saveMessage && <p className="ticketMeta">{saveMessage}</p>}
              </div>
              {loading && <div className="card"><p className="muted">Loading Epic experiences and ticket types...</p></div>}
              {error && <div className="card"><p className="muted">{error}</p></div>}
              {!loading && !error && calculatedActivities.map(({ activity, experience, privateFeeRule, privateFee, rentalDays, total }, index) => experience ? (
                <div className="card activityCard" key={activity.key}>
                  <div className="activityHeader"><div className="activityNumber">Activity {index + 1}</div>{activities.length > 1 && <button className="removeLink" type="button" onClick={() => removeActivity(activity.key)}>Remove</button>}</div>
                  <div className="field"><label>Experience</label><select value={activity.experienceId} onChange={(e) => changeExperience(activity.key, e.target.value)}><option value="">None</option>{experiences.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}{pricingYear === 2027 && unavailable2027Options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{pricingYear === 2027 && pending2027[activity.experienceId] && <div className="availabilityError">{pending2027[activity.experienceId]}</div>}
                  {experience?.line === "rental" ? experience.tickets.map((ticket) => (
                    <div className="ticketRow" key={ticket.id}>
                      <div><div className="ticketTitle">{ticket.name} - {money.format(ticket.price)}</div><div className="ticketMeta">{ticket.note}</div></div>
                      <div className="qty"><button onClick={() => changeQty(activity.key, ticket.id, -1)}>-</button><span>{activity.qty[ticket.id] ?? 0}</span><button onClick={() => changeQty(activity.key, ticket.id, 1)}>+</button></div>
                    </div>
                  )) : null}
                  {experience ? (
                    <div className="availabilityCheck">
                      <div className="field availabilityDateField">
                        <label>Activity date</label>
                        <input
                          type="date"
                          value={availabilityDates[activity.key] ?? visitStart}
                          onChange={(e) => setAvailabilityDates((current) => ({ ...current, [activity.key]: e.target.value }))}
                        />
                      </div>
                      <button
                        className="secondary availabilityButton"
                        type="button"
                        onClick={() => checkAvailability(activity.key, experience.id)}
                        disabled={availabilityByActivity[activity.key]?.loading || (experience.line === "rental" && !Object.values(activity.qty).some((quantity) => quantity > 0))}
                      >
                        {availabilityByActivity[activity.key]?.loading ? "Checking..." : "Check Availability"}
                      </button>
                    </div>
                  ) : null}
                  {availabilityByActivity[activity.key]?.error ? (
                    <div className="availabilityError">{availabilityByActivity[activity.key].error}</div>
                  ) : null}
                  {availabilityByActivity[activity.key]?.timeslots.length ? (
                    <div className="availabilityResults">
                      {availabilityByActivity[activity.key].timeslots.map((slot, slotIndex) => {
                        const status = slot.experience_timeslot_status?.name || "Unknown";
                        const open = slot.experience_timeslot_status?.slug === "open" || status.toLowerCase() === "open";
                        const selectedTickets = experience.tickets.filter((ticket) => (activity.qty[ticket.id] ?? 0) > 0);
                        const selectedAvailability = selectedTickets.map((ticket) => ({
                          ticket,
                          quantity: activity.qty[ticket.id] ?? 0,
                          inventory: matchingAvailability(slot, ticket),
                        }));
                        const hasSelectedRentalTickets = experience.line === "rental" && selectedTickets.length > 0;
                        const rentalSlotSupportsSelection = !hasSelectedRentalTickets || selectedAvailability.every((entry) =>
                          Boolean(entry.inventory) &&
                          typeof entry.inventory?.availability_cnt === "number" &&
                          entry.inventory.availability_cnt >= entry.quantity
                        );
                        if (experience.line === "rental" && (!open || !rentalSlotSupportsSelection)) return null;

                        const visibleTickets = experience.line === "rental" && selectedTickets.length
                          ? selectedAvailability.filter((entry) => entry.inventory).map((entry) => entry.inventory!)
                          : (slot.availabilities || []).filter((item) => item.customer_type?.is_visible !== false);

                        const gatewaySharedPool = isGatewaySharedVehicleExperience(experience);
                        const gatewaySelectedVehicles = gatewaySharedPool ? gatewaySelectedVehicleCount(activity, experience) : 0;
                        const gatewayVehicleInventories = gatewaySharedPool
                          ? experience.tickets
                              .filter(isGatewayVehicleTicket)
                              .map((ticket) => matchingAvailability(slot, ticket))
                              .filter((item): item is TripWorksAvailabilityTicket => Boolean(item && typeof item.availability_cnt === "number"))
                          : [];
                        const gatewaySharedRemaining = gatewayVehicleInventories.length
                          ? Math.min(...gatewayVehicleInventories.map((item) => item.availability_cnt as number))
                          : null;

                        const overbookedSelection = gatewaySharedPool && typeof gatewaySharedRemaining === "number" && gatewaySelectedVehicles > gatewaySharedRemaining
                          ? selectedAvailability.find((entry) => isGatewayVehicleTicket(entry.ticket))
                          : selectedAvailability.find((entry) =>
                              typeof entry.inventory?.availability_cnt === "number" && entry.quantity > entry.inventory.availability_cnt
                            );

                        return (
                          <div className="availabilitySlot" key={String(slot.id ?? slot.start_time ?? slotIndex)}>
                            <div className="availabilitySlotTop">
                              <strong>{slot.time_label || slot.label || slot.full_label || slot.start_time || "Timeslot"}</strong>
                              <span className={open ? "availabilityStatus open" : status.toLowerCase() === "closed" ? "availabilityStatus closed" : "availabilityStatus"}>{status}</span>
                            </div>
                            {visibleTickets.length ? (
                              <div className="availabilityTickets">
                                {visibleTickets.map((item, ticketIndex) => {
                                  const remaining = item.availability_cnt;
                                  const label = item.customer_type?.name || "Ticket";
                                  return (
                                    <span className="availabilityInventory" key={String(item.customer_type?.id ?? ticketIndex)}>
                                      <strong>{label}</strong>
                                      <span>{(() => {
                                        if (typeof remaining !== "number") return "Availability loaded";
                                        const selectedEntry = selectedAvailability.find((entry) => entry.inventory === item);
                                        const selected = selectedEntry?.quantity || 0;
                                        const isGatewayVehicleInventory = gatewaySharedPool && experience.tickets
                                          .filter(isGatewayVehicleTicket)
                                          .some((ticket) => matchingAvailability(slot, ticket) === item);
                                        const selectedForPool = isGatewayVehicleInventory ? gatewaySelectedVehicles : selected;
                                        const poolRemaining = isGatewayVehicleInventory && typeof gatewaySharedRemaining === "number"
                                          ? gatewaySharedRemaining
                                          : remaining;
                                        const afterQuote = poolRemaining - selectedForPool;
                                        if (poolRemaining === 0) return "Sold out";
                                        if (selectedForPool > poolRemaining) return `${poolRemaining} left · quote needs ${selectedForPool}`;
                                        return selectedForPool > 0 ? `${afterQuote} left after quote` : `${poolRemaining} left`;
                                      })()}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="ticketMeta">
                                {typeof slot.availability_cnt === "number" ? `${slot.availability_cnt} available` : "Availability loaded"}
                              </div>
                            )}
                            {slot.note ? <div className="ticketMeta availabilityNote">{slot.note}</div> : null}
                            {overbookedSelection ? <div className="availabilityError">{gatewaySharedPool && typeof gatewaySharedRemaining === "number" ? `Only ${gatewaySharedRemaining} total Gateway vehicles are available for this departure, but this quote needs ${gatewaySelectedVehicles}.` : `Only ${overbookedSelection.inventory?.availability_cnt ?? 0} available for ${overbookedSelection.ticket.name}, but this quote needs ${overbookedSelection.quantity}.`}</div> : null}
                            {open && !overbookedSelection ? (
                              <button
                                className="secondary availabilityBookButton"
                                type="button"
                                onClick={() => { if (dateSeasonMismatch || (pricingYear === 2027 && !effectiveVisitStart.startsWith("2027-")) || activities.some(a => Boolean(pending2027[a.experienceId]))) { setSaveMessage("Correct and verify the pricing season before booking."); return; } beginBooking({
                                  experienceId: experience.id,
                                  experienceName: experience.name,
                                  date: availabilityByActivity[activity.key]?.date || availabilityDates[activity.key] || visitStart,
                                  time: slot.time_label || slot.label || slot.full_label || slot.start_time || "",
                                  total,
                                }); }}
                              >
                                Book It
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {experience?.line === "tour" ? experience.tickets.map((ticket) => (
                    <div className="ticketRow" key={ticket.id}>
                      <div><div className="ticketTitle">{ticket.name} - {money.format(ticket.price)}</div><div className="ticketMeta">{ticket.note}</div></div>
                      <div className="qty"><button onClick={() => changeQty(activity.key, ticket.id, -1)}>-</button><span>{activity.qty[ticket.id] ?? 0}</span><button onClick={() => changeQty(activity.key, ticket.id, 1)}>+</button></div>
                    </div>
                  )) : null}
                  {privateFeeRule && (
                    <div className="toggleRow">
                      <div><strong>{privateFeeRule.fee_label}</strong><div className="ticketMeta">Automatically added once to this private tour, regardless of vehicle quantity.</div></div>
                      <strong>{money.format(privateFee)}</strong>
                    </div>
                  )}
                  {experience ? <div className="toggleRow"><div><strong>TripSafe</strong><div className="ticketMeta">Optional protection at 9% for this activity</div></div><input type="checkbox" checked={activity.tripSafe} onChange={(e) => updateActivity(activity.key, { tripSafe: e.target.checked })} /></div> : null}
                  {experience?.line === "rental" && (
                    <div className="toggleRow">
                      <div><strong>Premier Adventure Assure</strong><div className="ticketMeta">$69/day · currently {rentalDays} day{rentalDays === 1 ? "" : "s"}</div></div>
                      <input type="checkbox" checked={activity.premier} onChange={(e) => updateActivity(activity.key, { premier: e.target.checked })} />
                    </div>
                  )}
                  {experience?.line === "rental" && <>
                    <div className="toggleRow"><div><strong>Prior Evening Pickup</strong><div className="ticketMeta">$50 · subject to sales and rental tax</div></div><input type="checkbox" checked={activity.priorEveningPickup} onChange={(e) => updateActivity(activity.key, { priorEveningPickup: e.target.checked })}/></div>
                    <div className="toggleRow"><div><strong>Next Morning Drop-off</strong><div className="ticketMeta">$50 · subject to sales and rental tax</div></div><input type="checkbox" checked={activity.nextMorningDropoff} onChange={(e) => updateActivity(activity.key, { nextMorningDropoff: e.target.checked })}/></div>
                  </>}
                </div>
              ) : (
                <div className="card activityCard" key={activity.key}>
                  <div className="activityHeader"><div className="activityNumber">Activity {index + 1}</div>{activities.length > 1 && <button className="removeLink" type="button" onClick={() => removeActivity(activity.key)}>Remove</button>}</div>
                  <div className="field">
                    <label htmlFor={`experience-${activity.key}`}>Experience</label>
                    <select id={`experience-${activity.key}`} value={activity.experienceId} onChange={(e) => changeExperience(activity.key, e.target.value)}>
                      <option value="">Select an experience</option>
                      {experiences.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      {pricingYear === 2027 && unavailable2027Options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>
                  {pricingYear === 2027 && pending2027[activity.experienceId] && <div className="availabilityError">{pending2027[activity.experienceId]}</div>}
                </div>
              ))}
              {!loading && !error && <button className="addActivityFull" type="button" onClick={addActivity}>{activities.length ? "+ Add Another Activity" : "+ Add Activity"}</button>}
            </section>

            <section className="card summaryCard">
              <h2>Quote Summary</h2>
              {!calculatedActivities.some((item) => Boolean(item.experience)) ? <p className="muted">Add an activity to begin an estimate.</p> : null}
              {calculatedActivities.map(({ activity, experience, total }, index) => experience && (
                <div className="quoteActivitySummary" key={activity.key}><div><strong>{index + 1}. {experience.name}</strong></div><strong>{money.format(total)}</strong></div>
              ))}
              <div className="summaryRow"><span>Ticket subtotal</span><strong>{money.format(totals.subtotal)}</strong></div>
              {totals.privateFees > 0 && <div className="summaryRow"><span>Private Tour Fee{calculatedActivities.filter((item) => item.privateFee > 0).length > 1 ? "s" : ""}</span><strong>{money.format(totals.privateFees)}</strong></div>}
              {calculatedActivities.some((item) => item.overnightAmount > 0) && <div className="summaryRow"><span>Overnight Add-ons</span><strong>{money.format(calculatedActivities.reduce((sum,item)=>sum+item.overnightAmount,0))}</strong></div>}
              <div className="summaryRow"><span>Taxes</span><strong>{money.format(totals.tax)}</strong></div>
              <div className="summaryRow"><span>TripSafe</span><strong>{money.format(totals.tripSafe)}</strong></div>
              {totals.premier > 0 && <div className="summaryRow"><span>Premier Adventure Assure</span><strong>{money.format(totals.premier)}</strong></div>}
              <div className="summaryRow"><span>TripWorks booking fee (4%)</span><strong>{money.format(totals.twFee)}</strong></div>
              <div className="summaryRow total"><span>Estimated OTD</span><span>{money.format(totals.total)}</span></div>
              <button className="primary" type="button" onClick={() => setDetailsOpen(true)} disabled={dateSeasonMismatch || (pricingYear === 2027 && !effectiveVisitStart.startsWith("2027-")) || activities.some(a => Boolean(pending2027[a.experienceId])) || seasonLoading}>{editingQuoteId ? "Update Quote" : "Save Quote"}</button>
              {editingQuoteId && email.trim() ? <button className="secondary modalSecondary" type="button" onClick={handleSaveAndEmail} disabled={saving || emailing || dateSeasonMismatch || (pricingYear === 2027 && !effectiveVisitStart.startsWith("2027-")) || activities.some(a => Boolean(pending2027[a.experienceId]))}>{emailing ? "Emailing..." : "Email Quote"}</button> : null}
              {saveMessage && <p className="ticketMeta" style={{ marginBottom: 0 }}>{saveMessage}</p>}
            </section>
          </div>
        )}
      </section>

      {pendingSeason !== null && (
        <div className="modalBackdrop" onMouseDown={() => setPendingSeason(null)}>
          <div className="modalCard" role="alertdialog" aria-modal="true" aria-labelledby="season-change-title" onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="season-change-title">Caution: Changing Seasons Refreshes Your Quote Builder.</h2>
            <p>Unsaved quotes will be discarded.</p>
            <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:24}}>
              <button className="secondary" type="button" onClick={() => setPendingSeason(null)}>Cancel</button>
              <button className="primary" type="button" onClick={() => { const next = pendingSeason; setPendingSeason(null); void changePricingYear(next); }}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {detailsOpen && (
        <div className="modalBackdrop" onMouseDown={() => { setDetailsOpen(false); setPendingBooking(null); }}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sectionHeading"><div><h2>{pendingBooking ? (editingQuoteId ? "Update & Book It" : "Save & Book It") : editingQuoteId ? "Update Quote Details" : "Save Quote"}</h2><p className="muted compact">{pendingBooking ? "Confirm the guest details and save the current quote before handing it to TripWorks." : "Contact info is optional unless you want this attached to a lead."}</p></div><button className="removeLink" onClick={() => { setDetailsOpen(false); setPendingBooking(null); }}>Close</button></div>
            <div className="field"><label>Guest name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest name" /></div>
            <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" /></div>
            <div className="field"><label>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" /></div>
            <div className="modalDates">
              <div className="field"><label>Moab arrival / first activity</label><input type="date" value={visitStart} onChange={(e) => setVisitStart(e.target.value)} /></div>
              <div className="field"><label>Moab departure / last activity</label><input type="date" value={visitEnd} onChange={(e) => setVisitEnd(e.target.value)} /></div>
            </div>
            <button className="primary" type="button" onClick={handleSave} disabled={saving || dateSeasonMismatch || (pricingYear === 2027 && !effectiveVisitStart.startsWith("2027-")) || activities.some(a => Boolean(pending2027[a.experienceId]))}>{saving ? "Saving..." : pendingBooking ? (editingQuoteId ? "Update & Book It" : "Save & Book It") : phone.trim() || email.trim() ? (editingQuoteId ? "Update & Open C360" : "Save & Open C360") : (editingQuoteId ? "Update Quote" : "Save Quote")}</button>
            {!pendingBooking ? <button className="secondary modalSecondary" type="button" onClick={beginQuoteBookingFromDetails} disabled={saving || dateSeasonMismatch || (pricingYear === 2027 && !effectiveVisitStart.startsWith("2027-")) || activities.some(a => Boolean(pending2027[a.experienceId]))}>Book It</button> : null}
            {!pendingBooking ? <button className="secondary modalSecondary" type="button" onClick={handleSaveAndEmail} disabled={!email || saving || emailing || dateSeasonMismatch || (pricingYear === 2027 && !effectiveVisitStart.startsWith("2027-")) || activities.some(a => Boolean(pending2027[a.experienceId]))}>{emailing ? "Saving & Emailing..." : "Save & Email Quote"}</button> : null}
          </div>
        </div>
      )}
    </main>
  );
}
