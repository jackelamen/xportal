// Outbound webhooks to xPM and inbound auth for the sync bridge.

export function verifyBridgeSecret(request) {
  const secret = process.env.XPM_API_BRIDGE_SECRET;
  return !!secret && request.headers.get("x-xpm-bridge-secret") === secret;
}

// Fires a payload at xPM. With no XPM_WEBHOOK_URL configured (Phase 1) the
// payload is logged so the loop is still observable locally.
export async function notifyXpm(event, payload) {
  const body = { event, payload, sent_at: new Date().toISOString() };
  const url = process.env.XPM_WEBHOOK_URL;
  if (!url) {
    console.log(`[xPM bridge ⇡] ${event}`, JSON.stringify(payload));
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-XPM-Bridge-Secret": process.env.XPM_API_BRIDGE_SECRET || "",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[xPM bridge ⇡] ${event} delivery failed:`, err.message);
  }
}
