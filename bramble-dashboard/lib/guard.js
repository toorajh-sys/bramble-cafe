import { requireIdentity } from "../cursor/identity.js";

function json(body, status) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
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

/** Gate for routes that change data: a verified viewer, a same-site request, and never from the preview host. */
export async function requireWriter(request) {
  if (!isSameOrigin(request)) return json({ error: "Cross-site request refused." }, 403);
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (identity.kind !== "person") return json({ error: "Only a signed-in person can change sales data." }, 403);
  if (identity.stage === "preview") {
    return json({ error: "This is a preview, so uploads are switched off. Use the live dashboard to upload sales." }, 403);
  }
  return identity;
}

export { json };
