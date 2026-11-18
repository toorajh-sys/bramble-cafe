import { json, readViewer, requireWriter } from "../../../lib/guard.js";
import { normalizeSpecials } from "../../../lib/specials.js";
import { isIsoDate } from "../../../lib/today.js";

export const dynamic = "force-dynamic";

const MENU_ORIGIN = (process.env.BRAMBLE_MENU_URL || "https://bramble-cafe.apps.grok.bot").replace(/\/$/, "");

function menuUrl(date) {
  const url = new URL("/api/specials", MENU_ORIGIN);
  if (date) url.searchParams.set("date", date);
  return url;
}

export async function GET(request) {
  const identity = await readViewer(request);
  if (!identity.verified) return json({ error: "unauthorized", reason: identity.reason ?? "missing_header" }, 401);
  const date = new URL(request.url).searchParams.get("date");
  if (date !== null && !isIsoDate(date)) return json({ error: "Use a date like 2026-11-18." }, 400);
  try {
    const response = await fetch(menuUrl(date), { cache: "no-store" });
    const data = await response.json().catch(() => ({ error: "Could not load today's specials." }));
    return json(data, response.ok ? 200 : response.status);
  } catch {
    return json({ error: "Could not reach the menu." }, 502);
  }
}

export async function PUT(request) {
  const identity = await requireWriter(request);
  if (identity instanceof Response) return identity;
  const key = process.env.BRAMBLE_SPECIALS_KEY?.trim() ?? "";
  if (key === "") {
    return json({ error: "Add the same specials key on the menu and the dashboard, then save again." }, 503);
  }

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

  try {
    const response = await fetch(menuUrl(), {
      method: "PUT",
      headers: { "content-type": "application/json", "x-bramble-key": key },
      body: JSON.stringify({ items }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({ error: "Could not update the menu." }));
    return json(data, response.ok ? 200 : response.status);
  } catch {
    return json({ error: "Could not reach the menu." }, 502);
  }
}
