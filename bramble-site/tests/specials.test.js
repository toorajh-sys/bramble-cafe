import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { editorMayWrite, isConnected } from "../lib/editor.js";
import { normalizeSpecials } from "../lib/specials.js";

test("a blank special is not counted toward the three", () => {
  assert.equal(normalizeSpecials([{ name: "Soup", price: "9" }, { name: " " }]).length, 1);
});

test("only the connected dashboard key can change specials", () => {
  const key = "dashboard-key-for-tests";
  const fingerprints = [createHash("sha256").update(key).digest("hex")];
  assert.equal(isConnected(fingerprints), true);
  assert.equal(editorMayWrite(key, fingerprints), true);
  assert.equal(editorMayWrite("someone-else", fingerprints), false);
  assert.equal(editorMayWrite(fingerprints[0], fingerprints), false);
  assert.equal(editorMayWrite("", fingerprints), false);
});

test("the published menu trusts the dashboard connection code, not the code itself", () => {
  assert.equal(isConnected(), true);
  assert.equal(editorMayWrite("6a5490ba584ae2afdada772b1caa3a3ae1498b9c1f17c957cd2aa75b58020c3f"), false);
  assert.equal(editorMayWrite("not-the-dashboard-key"), false);
});

test("nothing can change specials before a dashboard is connected", () => {
  assert.equal(isConnected([]), false);
  assert.equal(editorMayWrite("anything", []), false);
});
