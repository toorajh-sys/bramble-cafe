import { sql, withTransaction } from "../../../lib/db.js";
import { editorMayWrite, isConnected } from "../../../lib/editor.js";
import { normalizeSpecials } from "../../../lib/specials.js";
import { cafeToday, isIsoDate } from "../../../lib/today.js";

export const dynamic = "force-dynamic";

function publicJson(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
  });
}

function writeJson(body, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
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
  return publicJson({ date, items: await readSpecials(date), connected: isConnected() });
}

export async function PUT(request) {
  if (!isConnected()) return writeJson({ error: "not_connected" }, 503);
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 16_384) {
    return writeJson({ error: "Those specials are too long." }, 413);
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!editorMayWrite(token)) {
    return writeJson({ error: "Could not update specials." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return writeJson({ error: "Could not read those specials." }, 400);
  }
  let items;
  try {
    items = normalizeSpecials(body?.items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save those specials.";
    return writeJson({ error: message }, 422);
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
  return writeJson({ ok: true, date, items });
}
