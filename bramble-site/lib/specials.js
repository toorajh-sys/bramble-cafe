import { timingSafeEqual } from "node:crypto";

const MAX_SPECIALS = 3;

export function normalizeSpecials(items) {
  if (!Array.isArray(items)) throw new Error("Send up to 3 specials.");
  const cleaned = [];
  for (const item of items) {
    const name = String(item?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (name === "") continue;
    const description = String(item?.description ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    let price = item?.price;
    if (price === "" || price === null || price === undefined) price = null;
    else {
      const numeric = typeof price === "number" ? price : Number(String(price).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 999) throw new Error("Enter a price as a number, like 4.50.");
      price = Math.round(numeric * 100) / 100;
    }
    cleaned.push({ name, description, price });
  }
  if (cleaned.length > MAX_SPECIALS) throw new Error("You can list up to 3 specials.");
  return cleaned;
}

export function keysMatch(given, expected) {
  const left = Buffer.from(String(given ?? ""));
  const right = Buffer.from(String(expected ?? ""));
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
