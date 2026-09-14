self.addEventListener("push", (event) => {
  let payload = {
    body: "You have a new ticket update.",
    title: "ParlayPal update",
  };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // A provider may deliver a notification without an optional payload.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      badge: "/favicon.png",
      body: payload.body,
      data: { url: payload.url || "/dashboard/notifications" },
      icon: "/logo.png",
      tag: payload.tag || "parlaypal-notification",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/dashboard/notifications",
    self.location.origin
  ).toString();

  const focusOrOpen = async () => {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: "window",
    });
    const openClient = clients.find(
      (client) => new URL(client.url).origin === self.location.origin
    );
    if (openClient) {
      const navigatedClient = await openClient.navigate(targetUrl);
      await navigatedClient?.focus();
      return;
    }
    await self.clients.openWindow(targetUrl);
  };
  event.waitUntil(focusOrOpen());
});
