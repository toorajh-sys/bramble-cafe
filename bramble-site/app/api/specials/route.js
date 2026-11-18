import { sql, withTransaction } from "../../../lib/db.js";
import { keysMatch, normalizeSpecials } from "../../../lib/specials.js";
import { cafeToday, isIsoDate } from "../../../lib/today.js";

export const dynamic = "force-dynamic";

function publicJson(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
  });
}

async function readSpecials(date) {
  const rows = await sql(
    `select name, description, price from specials where special_date = $1::date order by position`,
    [date],
  );
  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    price: row.price === null ? null : Number(row.price),
  }));
}

export async function GET(request) {
  const requested = new URL(request.url).searchParams.get("date");
  const date = requested === null ? cafeToday() : requested;
  if (!isIsoDate(date)) return publicJson({ error: "Use a date like 2026-11-18." }, 400);
  return publicJson({ date, items: await readSpecials(date) });
}

export async function PUT(request) {
  const key = process.env.BRAMBLE_SPECIALS_KEY?.trim() ?? "";
  if (key === "" || !keysMatch(request.headers.get("x-bramble-key"), key)) {
    return publicJson({ error: "Could not update specials." }, key === "" ? 503 : 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return publicJson({ error: "Could not read those specials." }, 400);
  }
  let items;
  try {
    items = normalizeSpecials(body?.items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save those specials.";
    return publicJson({ error: message }, 422);
  }

  const date = cafeToday();
  await withTransaction(async (query) => {
    await query("delete from specials where special_date = $1::date", [date]);
    if (items.length === 0) return;
    await query(
      `insert into specials (special_date, position, name, description, price)
       select $1::date, t.position, t.name, t.description, t.price
         from unnest($2::int[], $3::text[], $4::text[], $5::numeric[]) as t(position, name, description, price)`,
      [date, items.map((_, index) => index + 1), items.map((item) => item.name), items.map((item) => item.description), items.map((item) => item.price)],
    );
  });
  return publicJson({ ok: true, date, items });
}
