import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const shared = globalThis.__brambleDb ?? (globalThis.__brambleDb = {});

export async function sql(text, params = []) {
  if (databaseUrl !== "") {
    shared.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await shared.pool.query(text, params)).rows;
  }
  shared.local ??= startLocal().catch((error) => {
    shared.local = undefined;
    throw error;
  });
  return (await (await shared.local).query(text, params)).rows;
}

async function startLocal() {
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
