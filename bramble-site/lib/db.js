import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const shared = globalThis.__brambleCafeDb ?? (globalThis.__brambleCafeDb = {});

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

async function client() {
  if (databaseUrl !== "") {
    shared.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return shared.pool.connect();
  }
  shared.local ??= startLocal().catch((error) => {
    shared.local = undefined;
    throw error;
  });
  const db = await shared.local;
  return {
    query: (text, params) => db.query(text, params),
    release() {},
  };
}

export async function withTransaction(run) {
  const connection = await client();
  try {
    await connection.query("begin");
    const result = await run((text, params = []) => connection.query(text, params).then((res) => res.rows));
    await connection.query("commit");
    return result;
  } catch (error) {
    await connection.query("rollback");
    throw error;
  } finally {
    connection.release();
  }
}

async function startLocal() {
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
