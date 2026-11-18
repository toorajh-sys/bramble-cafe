const DAY_MS = 86400000;

export function toDayNumber(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function rangeStart(latest, range) {
  const days = { "7": 7, "30": 30, "90": 90 }[range];
  return days ? fromDayNumber(toDayNumber(latest) - (days - 1)) : null;
}

/** Fills days without sales with zero so the chart shows quiet days honestly. */
export function fillDays(rows, start, end) {
  const byDate = new Map(rows.map((r) => [r.day, r]));
  const out = [];
  for (let n = toDayNumber(start); n <= toDayNumber(end); n += 1) {
    const day = fromDayNumber(n);
    const row = byDate.get(day);
    out.push({ day, revenue: row?.revenue ?? 0, units: row?.units ?? 0 });
  }
  return out;
}

function weekStart(ymd) {
  const n = toDayNumber(ymd);
  const weekday = (n + 3) % 7;
  return fromDayNumber(n - weekday);
}

/** Collapses a long daily series into Monday-based weeks. */
export function bucketWeeks(days) {
  const weeks = new Map();
  for (const d of days) {
    const key = weekStart(d.day);
    const w = weeks.get(key) ?? { day: key, revenue: 0, units: 0 };
    w.revenue += d.revenue;
    w.units += d.units;
    weeks.set(key, w);
  }
  return [...weeks.values()].map((w) => ({ ...w, revenue: Math.round(w.revenue * 100) / 100 }));
}

/** Monday-based this week so far, last full week, and the same weekdays last week. */
export function weekComparison(today) {
  const end = toDayNumber(today);
  const weekday = (end + 3) % 7;
  const thisStart = end - weekday;
  const lastStart = thisStart - 7;
  return {
    thisStart: fromDayNumber(thisStart),
    thisEnd: today,
    lastStart: fromDayNumber(lastStart),
    lastEnd: fromDayNumber(thisStart - 1),
    lastSameEnd: fromDayNumber(lastStart + weekday),
  };
}

export function sumBetween(rows, start, end) {
  const first = toDayNumber(start);
  const last = toDayNumber(end);
  const total = rows.reduce(
    (sum, row) => {
      const day = toDayNumber(row.day);
      if (day < first || day > last) return sum;
      return { revenue: sum.revenue + row.revenue, units: sum.units + row.units };
    },
    { revenue: 0, units: 0 },
  );
  return {
    revenue: Math.round(total.revenue * 100) / 100,
    units: Math.round(total.units * 100) / 100,
  };
}

export function weekChange(current, previous) {
  const round = (value) => Math.round(value * 100) / 100;
  const now = round(current);
  const then = round(previous);
  if (now === then) return "No change";
  if (then === 0) return "No sales on these days last week";
  const percent = Math.round(((now - then) / then) * 100);
  return `${percent > 0 ? "Up" : "Down"} ${Math.abs(percent)}%`;
}

export function niceMax(value) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * base) return step * base;
  }
  return 10 * base;
}
