self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "EpicTools";
  const options = {
    body: data.body || "A booking acknowledgement is ready.",
    icon: "/epic-logo.png",
    badge: "/epic-logo.png",
    tag: data.readinessId ? `epic-cancellation-${data.readinessId}` : "epic-cancellation",
    data: {
      url: data.url || "/team/readiness",
      readinessId: data.readinessId || null,
      confirmationCode: data.confirmationCode || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/team/readiness";

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const absoluteTarget = new URL(targetUrl, self.location.origin).href;

    for (const client of clientsList) {
      if ("focus" in client) {
        try {
          await client.navigate(absoluteTarget);
        } catch {
          // If navigation is not allowed for this client, opening a new window below is the fallback.
        }
        await client.focus();
        return;
      }
    }

    if (self.clients.openWindow) await self.clients.openWindow(absoluteTarget);
  })());
});
