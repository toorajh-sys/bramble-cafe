import { sql } from "../../../lib/db.js";
import { json, requireWriter } from "../../../lib/guard.js";

export const dynamic = "force-dynamic";

export async function DELETE(request) {
  const identity = await requireWriter(request);
  if (identity instanceof Response) return identity;
  const [result] = await sql("with gone as (delete from sales returning 1) select count(*)::int as removed from gone");
  return json({ ok: true, removed: result.removed }, 200);
}
