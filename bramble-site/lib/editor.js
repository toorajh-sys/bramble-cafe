import { createHash, timingSafeEqual } from "node:crypto";

// SHA-256 fingerprints of the dashboard's specials key, copied from the dashboard's connection code.
// The key itself lives only in the dashboard's database; a fingerprint cannot be turned back into it.
export const DASHBOARD_KEY_FINGERPRINTS = [];

export function isConnected(fingerprints = DASHBOARD_KEY_FINGERPRINTS) {
  return fingerprints.length > 0;
}

/** Only the connected dashboard, holding its own key, may replace today's specials. */
export function editorMayWrite(token, fingerprints = DASHBOARD_KEY_FINGERPRINTS) {
  if (typeof token !== "string" || token === "" || token.length > 256) return false;
  const given = createHash("sha256").update(token).digest();
  return fingerprints.some((hex) => {
    const expected = Buffer.from(hex, "hex");
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}
