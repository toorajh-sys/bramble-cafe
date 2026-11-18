import { createHash, randomBytes } from "node:crypto";
import { sql } from "./db.js";

/** The dashboard's own key for saving specials on the menu. It is made once in this app's database and only ever sent to the menu. */
export async function menuSecret() {
  await sql("insert into menu_link (id, secret) values (1, $1) on conflict (id) do nothing", [
    randomBytes(32).toString("base64url"),
  ]);
  const rows = await sql("select secret from menu_link where id = 1");
  return rows[0].secret;
}

/** Safe to show: the menu checks saves against this fingerprint and cannot work the key back out of it. */
export function connectionCode(secret) {
  return createHash("sha256").update(secret).digest("hex");
}
