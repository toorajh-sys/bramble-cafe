import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpecials } from "../lib/specials.js";
import { isIsoDate } from "../lib/today.js";

test("normalizeSpecials keeps three named items and drops blanks", () => {
  const items = normalizeSpecials([
    { name: "  Maple oat latte ", description: "Oat and maple", price: "$5.50" },
    { name: "   ", description: "skip" },
    { name: "Scone", description: "", price: "" },
    { name: "Soup", price: 9 },
  ]);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], { name: "Maple oat latte", description: "Oat and maple", price: 5.5 });
  assert.equal(items[1].price, null);
});

test("normalizeSpecials refuses a fourth named special", () => {
  assert.throws(
    () => normalizeSpecials([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }]),
    /3 specials/,
  );
});

test("dates are real calendar days", () => {
  assert.equal(isIsoDate("2026-11-18"), true);
  assert.equal(isIsoDate("2026-02-31"), false);
  assert.equal(isIsoDate("18-11-2026"), false);
});
