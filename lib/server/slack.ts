type SlackSendResult = {
  sent: boolean;
  method: "bot" | "webhook" | "not_configured";
  error?: string;
};

export async function sendSlackChannelMessage(input: { channelId: string; text: string }): Promise<SlackSendResult> {
  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  if (botToken) {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: input.channelId, text: input.text }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
    if (!response.ok || payload.ok !== true) {
      return { sent: false, method: "bot", error: payload.error || `Slack returned ${response.status}.` };
    }
    return { sent: true, method: "bot" };
  }

  const webhookUrl = process.env.SLACK_REPAIRS_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.text }),
      cache: "no-store",
    });
    if (!response.ok) return { sent: false, method: "webhook", error: await response.text() };
    return { sent: true, method: "webhook" };
  }

  return { sent: false, method: "not_configured", error: "Slack repairs channel delivery is not configured in Epic Tools." };
}
