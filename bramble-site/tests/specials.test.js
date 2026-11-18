import assert from "node:assert/strict";
import test from "node:test";
import { editorMayWrite } from "../lib/editor.js";
import { normalizeSpecials } from "../lib/specials.js";

test("a blank special is not counted toward the three", () => {
  assert.equal(normalizeSpecials([{ name: "Soup", price: "9" }, { name: " " }]).length, 1);
});

test("a missing or made-up sign-in cannot change specials", async () => {
  const previous = process.env.CURSOR_APP_ID;
  process.env.CURSOR_APP_ID = "app_test";
  try {
    assert.equal(await editorMayWrite(""), false);
    assert.equal(await editorMayWrite("not-a-token"), false);
  } finally {
    if (previous === undefined) delete process.env.CURSOR_APP_ID;
    else process.env.CURSOR_APP_ID = previous;
  }
});
