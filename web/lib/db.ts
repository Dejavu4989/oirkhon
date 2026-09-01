// Postgres access for the web app.
//
// Set DATABASE_URL to enable accounts, e.g.
//   postgresql://oirkhon:secret@localhost:5432/oirkhon
//
// Everything account-related degrades gracefully when it is unset: the daily
// game still runs anonymously off data/web/export.json.gz, and the sign-in UI
// reports that accounts are not configured rather than erroring.
import { Pool } from "pg";

// Next's dev server re-evaluates modules on edit; without this each reload
// would leak another pool and exhaust Postgres connections.
declare global {
  // eslint-disable-next-line no-var
  var __oirkhonPool: Pool | undefined;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!isDbConfigured()) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalThis.__oirkhonPool) {
    globalThis.__oirkhonPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalThis.__oirkhonPool;
}

export async function query<T = Record<string, unknown>>(
  text: string, params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  text: string, params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Release pooled connections — used by tests so the process can exit. */
export async function closePool(): Promise<void> {
  if (globalThis.__oirkhonPool) {
    await globalThis.__oirkhonPool.end();
    globalThis.__oirkhonPool = undefined;
  }
}
