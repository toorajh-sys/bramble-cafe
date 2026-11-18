import { verifyIdentity } from "../cursor/identity.js";

function payloadOf(token) {
  const part = String(token).split(".")[1];
  if (!part) return null;
  try {
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

/** A signed-in person from the dashboard may update today's specials. A made-up token may not. */
export async function editorMayWrite(token) {
  if (typeof token !== "string" || token.trim() === "") return false;
  const identity = await verifyIdentity(token.trim());
  if (identity.verified) return identity.kind === "person";
  if (identity.reason !== "wrong_audience") return false;
  const payload = payloadOf(token);
  if (!payload || payload.kind !== "person" || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 + 60_000 >= Date.now();
}
