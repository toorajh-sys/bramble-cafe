import assert from "node:assert/strict";
import test from "node:test";
import { nowInZone, openLabel } from "../public/app.js";

const HOURS = { wed: ["07:00", "16:00"] };

test("wednesday at 2:45pm Pacific is open until 4", () => {
  const now = nowInZone("America/Los_Angeles", new Date("2026-11-18T22:45:00Z"));
  assert.equal(now.day, "wed");
  assert.equal(now.minutes, 14 * 60 + 45);
  assert.equal(openLabel(HOURS, now), "Open now until 4pm");
});

test("the same moment is after closing in New York", () => {
  const now = nowInZone("America/New_York", new Date("2026-11-18T22:45:00Z"));
  assert.equal(openLabel(HOURS, now), "Closed for today");
});

test("4pm is closed and the minute before is open", () => {
  assert.equal(openLabel(HOURS, { day: "wed", minutes: 15 * 60 + 59 }), "Open now until 4pm");
  assert.equal(openLabel(HOURS, { day: "wed", minutes: 16 * 60 }), "Closed for today");
});
