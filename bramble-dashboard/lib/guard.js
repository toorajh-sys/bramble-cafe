import { getIdentity, requireIdentity } from "../cursor/identity.js";

function json(body, status) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

function platformSignsIdentity() {
  const appId = typeof process.env.CURSOR_APP_ID === "string" ? process.env.CURSOR_APP_ID.trim() : "";
  const host = typeof process.env.VERCEL === "string" ? process.env.VERCEL.trim() : "";
  return appId !== "" || host !== "";
}

function rejectUnsigned(identity) {
  if (!identity?.verified || identity.simulated || !platformSignsIdentity()) {
    return { verified: false, reason: "missing_header" };
  }
  return identity;
}

/** A viewer the hosting gate signed. The local fallback is never treated as signed in. */
export async function readViewer(request) {
  return rejectUnsigned(await getIdentity(request));
}

function hostsMatch(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  return left.replace(/:\d+$/, "") === right.replace(/:\d+$/, "");
}

/** A browser same-origin upload stays allowed when the proxy host header does not match the public address. */
export function allowsWriteOrigin(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  if (site === "same-origin" || site === "none") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost = "";
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const candidates = [];
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) candidates.push(...forwarded.split(",").map((part) => part.trim().toLowerCase()));
  const host = request.headers.get("host");
  if (host) candidates.push(host.trim().toLowerCase());
  try {
    candidates.push(new URL(request.url).host.toLowerCase());
  } catch {
    // The request URL is not needed when a forwarded host already matched.
  }
  return candidates.some((candidate) => hostsMatch(candidate, originHost));
}

/** Gate for routes that change data: a gate-signed person, a same-site request, and never from the preview host. */
export async function requireWriter(request) {
  if (!allowsWriteOrigin(request)) return json({ error: "Cross-site request refused." }, 403);
  const checked = await requireIdentity(request);
  if (checked instanceof Response) return checked;
  const identity = rejectUnsigned(checked);
  if (!identity.verified) return json({ error: "unauthorized", reason: "missing_header" }, 401);
  if (identity.kind !== "person") return json({ error: "Only a signed-in person can change this." }, 403);
  if (identity.stage === "preview") {
    return json({ error: "This is a preview, so uploads are switched off. Use the live dashboard to upload sales." }, 403);
  }
  return identity;
}

export { json };
