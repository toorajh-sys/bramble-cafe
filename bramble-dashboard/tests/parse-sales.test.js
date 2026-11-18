import test from "node:test";
import assert from "node:assert/strict";
import { parseDate, parseMoney, rowsToSales, detectColumns } from "../lib/parse-sales.js";
import { bucketWeeks, fillDays, niceMax, rangeStart } from "../lib/stats.js";

test("parseMoney handles currency symbols, thousands and negatives", () => {
  assert.equal(parseMoney("$1,234.50"), 1234.5);
  assert.equal(parseMoney("(3.00)"), -3);
  assert.equal(parseMoney("4,50"), 4.5);
  assert.equal(parseMoney("1,234"), 1234);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney(7), 7);
});

test("parseDate handles ISO, US, day-first, Date objects and serials", () => {
  assert.equal(parseDate("2026-11-03"), "2026-11-03");
  assert.equal(parseDate("2026-11-03 08:15:00"), "2026-11-03");
  assert.equal(parseDate("11/3/2026"), "2026-11-03");
  assert.equal(parseDate("13/11/2026", "dmy"), "2026-11-13");
  assert.equal(parseDate(new Date(Date.UTC(2026, 10, 3))), "2026-11-03");
  assert.equal(parseDate(46329), "2026-11-03");
  assert.equal(parseDate("Nov 3, 2026"), "2026-11-03");
  assert.equal(parseDate("2026-02-31"), null);
  assert.equal(parseDate("hello"), null);
});

test("detectColumns picks Total over Price and does not reuse columns", () => {
  const c = detectColumns(["Date", "Item Name", "Qty", "Unit Price", "Line Total"]);
  assert.deepEqual(c, { date: 0, item: 1, quantity: 2, total: 4, price: -1 });
});

test("rowsToSales multiplies unit price by quantity when no total column", () => {
  const { sales, skipped } = rowsToSales([
    ["Date", "Item", "Qty", "Price"],
    ["2026-11-03", "Latte", 2, "$4.50"],
    ["2026-11-03", "", 1, 3],
    [],
    ["bad", "Scone", 1, 3],
  ]);
  assert.deepEqual(sales, [{ saleDate: "2026-11-03", item: "Latte", quantity: 2, revenue: 9 }]);
  assert.equal(skipped, 2);
});

test("rowsToSales explains missing columns", () => {
  assert.throws(() => rowsToSales([["Foo", "Bar"], [1, 2]]), /date column/);
  assert.throws(() => rowsToSales([]), /empty/);
});

test("day-first files are detected from any unambiguous row", () => {
  const { sales } = rowsToSales([
    ["Date", "Item", "Total"],
    ["03/11/2026", "Latte", 4],
    ["25/11/2026", "Latte", 4],
  ]);
  assert.deepEqual(sales.map((s) => s.saleDate), ["2026-11-03", "2026-11-25"]);
});

test("stats helpers", () => {
  assert.equal(rangeStart("2026-11-30", "7"), "2026-11-24");
  assert.equal(rangeStart("2026-11-30", "all"), null);
  const days = fillDays([{ day: "2026-11-02", revenue: 5, units: 1 }], "2026-11-01", "2026-11-03");
  assert.deepEqual(days.map((d) => d.revenue), [0, 5, 0]);
  const weeks = bucketWeeks(fillDays([], "2026-11-01", "2026-11-09"));
  assert.deepEqual(weeks.map((w) => w.day), ["2026-10-26", "2026-11-02", "2026-11-09"]);
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(137), 200);
  assert.equal(niceMax(1000), 1000);
});
