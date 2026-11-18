import assert from "node:assert/strict";
import test from "node:test";
import { readSavedSpecials, saveSpecials } from "../lib/saved-specials.js";

test("today's specials are remembered and another day's are not", async () => {
  await saveSpecials("2026-11-18", [{ name: "Soup", description: "Tomato", price: 4 }]);
  const saved = await readSavedSpecials("2026-11-18");
  assert.equal(saved[0].name, "Soup");
  assert.deepEqual(await readSavedSpecials("2026-11-19"), []);
});
