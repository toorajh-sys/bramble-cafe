import { sql } from "./db.js";

function asItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function readSavedSpecials(today) {
  const rows = await sql("select special_date::text as special_date, items from daily_specials where id = 1");
  const row = rows[0];
  if (!row || String(row.special_date).slice(0, 10) !== today) return [];
  return asItems(row.items);
}

export async function saveSpecials(today, items) {
  await sql(
    `insert into daily_specials (id, special_date, items) values (1, $1::date, $2::jsonb)
     on conflict (id) do update set special_date = excluded.special_date, items = excluded.items, updated_at = now()`,
    [today, JSON.stringify(items)],
  );
}
