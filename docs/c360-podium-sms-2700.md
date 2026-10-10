# Podium 2700 -> Epic C360 SMS integration

Status: isolated development branch; **not enabled in production**.

## Verified current state (2026-10-10)
- Epic Podium OAuth connection exists in `podium_oauth_connections`, location phone ends 2700.
- Existing OAuth scopes: `read_locations read_messages write_messages`.
- `lib/server/podium.ts` already sends Podium SMS for cancellation agreements. Do not modify or disconnect it.
- C360 correspondence and sales-text endpoints send through CallRail today. Reply-provider selection must use the **thread source**, not a phone-only guess.
- Podium webhook events: `message.received`, `message.sent`, `message.failed`; channel `conversation.channel.type === "phone"`.
- Webhook verification: HMAC-SHA256 over `podium-timestamp + "." + raw JSON`, header `podium-signature`. Require secret and reject unsigned payloads.
- Old Podium documentation shows some `message.sent` samples with null message UID. Use a stable event UID when available; preserve underlying message UID, and plan reconciliation.

## Implementation gates
1. Deploy a *separate* signed webhook receiver and durable `podium_sms_messages` table. Do not register a webhook until verification, permissions and exact location UID pass.
2. Persist all inbound/outbound events by event UID, with original source, created timestamp, message/conversation IDs, and raw JSON for repair. Filter to our Podium location and `phone` channel. Do not store or expose OAuth tokens in client-side views.
3. Match against current C360 customer identity using verified phone association; ambiguous numbers remain unmatched.
4. Add a consolidated message read adapter to C360 and inbox. Historical imported messages should not reopen closed tasks; **only new inbound** creates inbox attention.
5. Add explicit `podium` reply selection based on the currently opened thread, not the last phone-number matching CallRail text. Keep CallRail reply behavior unchanged for CallRail threads, and fail closed if ambiguous.
6. Route C360 Podium replies through existing `sendPodiumSms`; retain opt-out rules, transactional exceptions, user attribution, and prevent duplicate sends.
7. Validate message sent from Podium UI, inbound guest reply, sent from C360, failed delivery, idempotent replay, multiple channels/same number, attachments, and historic backfill before enabling production.
8. Confirm Podium webhook API creation or whether support must configure endpoint. Subscribe only to the three message events, filter SMS, and configure a signing secret.
9. Separate historical backfill strategy: Podium docs prioritize webhook live events; verify supported historical retrieval before promising a full import.

References:
- https://docs.podium.com/docs/sync-messages-from-podium-conversations
- https://docs.podium.com/docs/verifying-webhook-signatures
- https://docs.podium.com/reference/webhookcreate-1
- https://docs.podium.com/reference/message-event-types
