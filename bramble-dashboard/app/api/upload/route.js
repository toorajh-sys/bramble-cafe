import { readSheet } from "read-excel-file/node";
import Papa from "papaparse";
import { sql } from "../../../lib/db.js";
import { json, requireWriter } from "../../../lib/guard.js";
import { rowsToSales } from "../../../lib/parse-sales.js";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_ROWS } from "../../../lib/config.js";
import { assertXlsxWithinBudget, SpreadsheetTooLargeError } from "../../../lib/xlsx-budget.js";

export const dynamic = "force-dynamic";

async function readRows(file) {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".xlsx")) {
    assertXlsxWithinBudget(buffer);
    return readSheet(buffer);
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const parsed = Papa.parse(text, { skipEmptyLines: "greedy" });
    return parsed.data;
  }
  throw new Error("Please upload a .csv or .xlsx file. In Excel or Numbers, use File > Export or Save As.");
}

export async function POST(request) {
  const identity = await requireWriter(request);
  if (identity instanceof Response) return identity;

  let file;
  try {
    const form = await request.formData();
    file = form.get("file");
  } catch {
    return json({ error: "Could not read the upload." }, 400);
  }
  if (!file || typeof file === "string" || file.size === 0) {
    return json({ error: "Choose a spreadsheet to upload." }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ error: `That file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Try uploading one month at a time.` }, 413);
  }

  let parsed;
  try {
    const rows = await readRows(file);
    if (rows.length > MAX_UPLOAD_ROWS + 1) {
      return json({ error: `That sheet has more than ${MAX_UPLOAD_ROWS.toLocaleString()} rows. Try uploading one month at a time.` }, 413);
    }
    parsed = rowsToSales(rows);
  } catch (error) {
    if (error instanceof SpreadsheetTooLargeError) return json({ error: error.message }, 413);
    const message = error instanceof Error ? error.message : "Could not read that spreadsheet.";
    return json({ error: message }, 422);
  }

  const { sales, skipped, problems } = parsed;
  const dates = sales.map((s) => s.saleDate).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];

  // One statement, so the old rows for these dates are replaced atomically and re-uploading a file never double counts.
  const [result] = await sql(
    `with removed as (
       delete from sales where sale_date between $1::date and $2::date returning 1
     ), added as (
       insert into sales (sale_date, item, quantity, revenue)
       select * from unnest($3::date[], $4::text[], $5::numeric[], $6::numeric[])
       returning 1
     )
     select (select count(*) from removed)::int as replaced, (select count(*) from added)::int as added`,
    [first, last, sales.map((s) => s.saleDate), sales.map((s) => s.item), sales.map((s) => s.quantity), sales.map((s) => s.revenue)],
  );

  return json({ ok: true, added: result.added, replaced: result.replaced, skipped, problems, from: first, to: last }, 200);
}
