import assert from "node:assert/strict";
import test from "node:test";
import { keysMatch, normalizeSpecials } from "../lib/specials.js";

test("the write key must match exactly", () => {
  assert.equal(keysMatch("same-key", "same-key"), true);
  assert.equal(keysMatch("same-key", "other-key"), false);
  assert.equal(keysMatch("", "same-key"), false);
  assert.equal(keysMatch("short", "same-key"), false);
});

test("a blank special is not counted toward the three", () => {
  assert.equal(normalizeSpecials([{ name: "Soup", price: "9" }, { name: " " }]).length, 1);
});
