import { json, readViewer, requireWriter } from "../../../lib/guard.js";
import { connectionCode, menuSecret } from "../../../lib/menu-link.js";
import { readSavedSpecials, saveSpecials } from "../../../lib/saved-specials.js";
import { normalizeSpecials } from "../../../lib/specials.js";
import { cafeToday, isIsoDate } from "../../../lib/today.js";

export const dynamic = "force-dynamic";

const MENU_ORIGIN = "https://bramble-cafe.apps.grok.bot";

function menuUrl(date) {
  const url = new URL("/api/specials", MENU_ORIGIN);
  if (date) url.searchParams.set("date", date);
  return url;
}

export async function GET(request) {
  const identity = await readViewer(request);
  if (!identity.verified) return json({ error: "unauthorized", reason: identity.reason ?? "missing_header" }, 401);
  const requested = new URL(request.url).searchParams.get("date");
  if (requested !== null && !isIsoDate(requested)) return json({ error: "Use a date like 2026-11-18." }, 400);

  const today = cafeToday();
  const saved = await readSavedSpecials(today);
  const code = connectionCode(await menuSecret());
  let connected = false;
  let menuItems = null;
  try {
    const response = await fetch(menuUrl(requested), { cache: "no-store" });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      connected = data.connected === true;
      if (connected && Array.isArray(data.items)) menuItems = data.items;
    }
  } catch {
    connected = false;
  }
  return json({
    items: menuItems ?? saved,
    connected,
    connectionCode: connected ? null : code,
  });
}

export async function PUT(request) {
  const identity = await requireWriter(request);
  if (identity instanceof Response) return identity;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Could not read those specials." }, 400);
  }
  let items;
  try {
    items = normalizeSpecials(body?.items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save those specials.";
    return json({ error: message }, 422);
  }

  const today = cafeToday();
  await saveSpecials(today, items);
  const secret = await menuSecret();
  const code = connectionCode(secret);
  try {
    const response = await fetch(menuUrl(), {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ items }),
      cache: "no-store",
    });
    if (response.ok) return json({ ok: true, items, connected: true });
  } catch {
    // The menu did not answer. The specials are still saved on the dashboard.
  }
  return json(
    {
      error: "Saved on the dashboard. The public menu is not connected yet, so customers cannot see them until the connection code below is added.",
      needsConnection: true,
      connectionCode: code,
      items,
    },
    409,
  );
}
