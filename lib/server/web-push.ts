import webpush, { type PushSubscription } from "web-push";
import { supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type StoredPushSubscription = {
  id: string;
  team_profile_id: string;
  endpoint: string;
  subscription: PushSubscription;
  active: boolean;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:jennifer@epic4x4adventures.com",
    requiredEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
    requiredEnv("VAPID_PRIVATE_KEY"),
  );
}

export function webPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export async function sendTeamPushNotification(input: {
  teamProfileId: string;
  title: string;
  body: string;
  readinessId: string;
  confirmationCode: string;
}) {
  configureWebPush();
  const subscriptions = await supabaseSelect<StoredPushSubscription>(
    "epic_push_subscriptions",
    new URLSearchParams({
      select: "id,team_profile_id,endpoint,subscription,active",
      team_profile_id: `eq.${input.teamProfileId}`,
      active: "eq.true",
    }),
  );

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    readinessId: input.readinessId,
    confirmationCode: input.confirmationCode,
    url: `/team/readiness?cancellationReadinessId=${encodeURIComponent(input.readinessId)}`,
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (stored) => {
      try {
        await webpush.sendNotification(stored.subscription, payload, { TTL: 120 });
        await supabasePatch(
          "epic_push_subscriptions",
          new URLSearchParams({ id: `eq.${stored.id}` }),
          { last_success_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() },
        );
        return true;
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;
        const message = error instanceof Error ? error.message : "Push delivery failed.";
        await supabasePatch(
          "epic_push_subscriptions",
          new URLSearchParams({ id: `eq.${stored.id}` }),
          {
            active: statusCode === 404 || statusCode === 410 ? false : true,
            last_error: message.slice(0, 500),
            updated_at: new Date().toISOString(),
          },
        ).catch(() => undefined);
        throw error;
      }
    }),
  );

  return {
    attempted: subscriptions.length,
    delivered: results.filter((result) => result.status === "fulfilled").length,
  };
}
