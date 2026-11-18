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

function isSameOrigin(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Gate for routes that change data: a gate-signed person, a same-site request, and never from the preview host. */
export async function requireWriter(request) {
  if (!isSameOrigin(request)) return json({ error: "Cross-site request refused." }, 403);
  const checked = await requireIdentity(request);
  if (checked instanceof Response) return checked;
  const identity = rejectUnsigned(checked);
  if (!identity.verified) return json({ error: "unauthorized", reason: "missing_header" }, 401);
  if (identity.kind !== "person") return json({ error: "Only a signed-in person can change sales data." }, 403);
  if (identity.stage === "preview") {
    return json({ error: "This is a preview, so uploads are switched off. Use the live dashboard to upload sales." }, 403);
  }
  return identity;
}

export { json };
