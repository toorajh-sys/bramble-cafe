import assert from "node:assert/strict";
import test from "node:test";
import { allowsWriteOrigin, readViewer } from "../lib/guard.js";

function request({ site, origin, forwarded, host, url = "https://bramble-sales.apps.grok.bot/api/upload" }) {
  const headers = new Headers();
  if (site) headers.set("sec-fetch-site", site);
  if (origin) headers.set("origin", origin);
  if (forwarded) headers.set("x-forwarded-host", forwarded);
  if (host) headers.set("host", host);
  return { headers, url };
}

test("a same-origin upload is allowed when the proxy host does not match", () => {
  const allowed = allowsWriteOrigin(request({
    site: "same-origin",
    origin: "https://bramble-sales.apps.grok.bot",
    forwarded: "internal.local",
    host: "127.0.0.1:3000",
  }));
  assert.equal(allowed, true);
});

test("a forwarded host list still matches the public origin", () => {
  const allowed = allowsWriteOrigin(request({
    origin: "https://bramble-sales.apps.grok.bot",
    forwarded: "bramble-sales.apps.grok.bot, internal.local",
    host: "127.0.0.1:3000",
  }));
  assert.equal(allowed, true);
});

test("a cross-site upload is refused", () => {
  const allowed = allowsWriteOrigin(request({
    site: "cross-site",
    origin: "https://evil.example",
    host: "bramble-sales.apps.grok.bot",
  }));
  assert.equal(allowed, false);
});

test("a request with no identity header stays signed out", async () => {
  const previousAppId = process.env.CURSOR_APP_ID;
  const previousHost = process.env.VERCEL;
  delete process.env.CURSOR_APP_ID;
  delete process.env.VERCEL;
  try {
    const identity = await readViewer(new Headers());
    assert.equal(identity.verified, false);
    assert.equal(identity.reason, "missing_header");
  } finally {
    if (previousAppId === undefined) delete process.env.CURSOR_APP_ID;
    else process.env.CURSOR_APP_ID = previousAppId;
    if (previousHost === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousHost;
  }
});
