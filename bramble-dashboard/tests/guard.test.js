import assert from "node:assert/strict";
import test from "node:test";
import { readViewer } from "../lib/guard.js";

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
