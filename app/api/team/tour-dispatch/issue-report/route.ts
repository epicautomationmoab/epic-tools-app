import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { sendCallRailSms } from "@/lib/server/callrail";
import { sendSlackChannelMessage } from "@/lib/server/slack";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

type DispatchRow = {
  id: string;
  store_visit_id: string;
  confirmation_code: string | null;
  vehicle_slot: number;
  vehicle_label: string | null;
  vehicle_number: string | null;
};

type NotificationSettings = {
  setting_key: string;
  slack_channel_id: string;
  slack_channel_name: string;
  sms_recipient_name: string | null;
  sms_recipient_phone: string | null;
  sms_on_urgent: boolean;
  sms_on_critical: boolean;
};

type IssueReport = {
  id: string;
  dispatch_id: string;
  vehicle_number: string;
  confirmation_code: string | null;
  store_visit_id: string | null;
  escalation_level: string;
  experience_report: string;
  reported_by_name: string | null;
};

function normalizePhone(input: string | null) {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return input.startsWith("+") ? `+${digits}` : `+${digits}`;
}

function escalationLabel(level: string) {
  if (level === "critical") return "CRITICAL / SAFETY";
  if (level === "urgent") return "URGENT";
  return "MAINTENANCE NOTIFICATION";
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (!profile && !workstation) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const storeVisitId = String(body?.store_visit_id ?? "").trim();
    const vehicleSlot = Number(body?.vehicle_slot);
    const experienceReport = String(body?.experience_report ?? "").trim();
    const escalationLevel = String(body?.escalation_level ?? "").trim().toLowerCase();
    const guideName = String(body?.guide_name ?? "").trim();

    if (!storeVisitId || !Number.isInteger(vehicleSlot) || vehicleSlot < 1) {
      return NextResponse.json({ error: "Invalid tour vehicle slot." }, { status: 400 });
    }
    if (!experienceReport) {
      return NextResponse.json({ error: "Describe what you or the guest experienced with this vehicle." }, { status: 400 });
    }
    if (experienceReport.length > 2000) {
      return NextResponse.json({ error: "Keep the vehicle report under 2,000 characters." }, { status: 400 });
    }
    if (!["maintenance", "urgent", "critical"].includes(escalationLevel)) {
      return NextResponse.json({ error: "Choose Maintenance Notification, Urgent, or Critical / Safety." }, { status: 400 });
    }

    const dispatches = await supabaseSelect<DispatchRow>(
      "tour_vehicle_dispatches",
      new URLSearchParams({
        select: "id,store_visit_id,confirmation_code,vehicle_slot,vehicle_label,vehicle_number",
        store_visit_id: `eq.${storeVisitId}`,
        vehicle_slot: `eq.${vehicleSlot}`,
        limit: "1",
      }),
    );
    const dispatch = dispatches[0];
    if (!dispatch) return NextResponse.json({ error: "Tour vehicle dispatch record not found." }, { status: 404 });

    const settingsRows = await supabaseSelect<NotificationSettings>(
      "tour_vehicle_issue_notification_settings",
      new URLSearchParams({
        select: "setting_key,slack_channel_id,slack_channel_name,sms_recipient_name,sms_recipient_phone,sms_on_urgent,sms_on_critical",
        setting_key: "eq.default",
        limit: "1",
      }),
    );
    const settings = settingsRows[0];
    if (!settings) return NextResponse.json({ error: "Vehicle issue notification settings are missing." }, { status: 500 });

    const reporterName = guideName || profile?.display_name || "Epic Workstation";
    const vehicleNumber = dispatch.vehicle_number || dispatch.vehicle_label || "Unknown";
    const smsRequired = escalationLevel === "urgent" ? settings.sms_on_urgent : escalationLevel === "critical" ? settings.sms_on_critical : false;

    const report = await supabaseInsert<IssueReport>("tour_vehicle_issue_reports", {
      dispatch_id: dispatch.id,
      vehicle_number: vehicleNumber,
      confirmation_code: dispatch.confirmation_code,
      store_visit_id: dispatch.store_visit_id,
      escalation_level: escalationLevel,
      experience_report: experienceReport,
      reported_by_profile_id: profile?.id ?? null,
      reported_by_name: reporterName,
      vehicle_hold_requested: false,
      slack_notification_status: "pending",
      sms_notification_status: smsRequired ? "pending" : "not_required",
    });

    const title = escalationLabel(escalationLevel);
    const slackText = [
      `${escalationLevel === "critical" ? "🚨" : escalationLevel === "urgent" ? "⚠️" : "🔧"} *${title} — Vehicle ${vehicleNumber}*`,
      `Reported by: ${reporterName}`,
      dispatch.confirmation_code ? `TripWorks: ${dispatch.confirmation_code}` : null,
      `What was experienced: ${experienceReport}`,
    ].filter(Boolean).join("\n");

    const slackResult = await sendSlackChannelMessage({ channelId: settings.slack_channel_id, text: slackText });
    await supabasePatch(
      "tour_vehicle_issue_reports",
      new URLSearchParams({ id: `eq.${report.id}` }),
      {
        slack_notification_status: slackResult.sent ? "sent" : `failed:${slackResult.error || "unknown"}`,
        slack_notified_at: slackResult.sent ? new Date().toISOString() : null,
      },
    );

    let smsSent = false;
    let smsError: string | null = null;
    if (smsRequired) {
      const phone = normalizePhone(settings.sms_recipient_phone);
      if (!phone) {
        smsError = "SMS recipient phone is not configured.";
      } else {
        const smsBody = [
          `${title} - Vehicle ${vehicleNumber}`,
          `Reported by ${reporterName}`,
          experienceReport,
          dispatch.confirmation_code ? `TripWorks ${dispatch.confirmation_code}` : null,
        ].filter(Boolean).join("\n");
        try {
          await sendCallRailSms({ phone, body: smsBody });
          smsSent = true;
        } catch (error) {
          smsError = error instanceof Error ? error.message : "CallRail SMS failed.";
        }
      }
      await supabasePatch(
        "tour_vehicle_issue_reports",
        new URLSearchParams({ id: `eq.${report.id}` }),
        {
          sms_notification_status: smsSent ? "sent" : `failed:${smsError || "unknown"}`,
          sms_notified_at: smsSent ? new Date().toISOString() : null,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      report_id: report.id,
      slack_sent: slackResult.sent,
      sms_required: smsRequired,
      sms_sent: smsSent,
      notification_warning: !slackResult.sent || (smsRequired && !smsSent)
        ? [!slackResult.sent ? `Slack: ${slackResult.error}` : null, smsRequired && !smsSent ? `SMS: ${smsError}` : null].filter(Boolean).join(" ")
        : null,
    });
  } catch (error) {
    console.error("Tour vehicle issue report failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to report vehicle issue." },
      { status: 500 },
    );
  }
}
