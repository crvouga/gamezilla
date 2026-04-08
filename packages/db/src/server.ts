/**
 * Dev DB server: PGlite exposed over a tiny HTTP SQL API.
 *
 * PGlite runs in-process (no socket server, no WS proxy). A single
 * `POST /sql` endpoint accepts `{ sql, params? }` and returns rows +
 * metadata. Limits mimic PlanetScale's HTTP API so issues surface locally
 * before hitting production.
 */

import { PGlite } from '@electric-sql/pglite';

const SQL_PORT = parseInt(process.env['SQL_PORT'] ?? '15432', 10);
const HOST = '127.0.0.1';
const DATA_DIR = process.env['GAMEZILLA_DATA_DIR'];

// PlanetScale HTTP API limits
const LIMITS = {
  maxBodyBytes: 16 * 1024 * 1024,
  maxSqlBytes: 16 * 1024 * 1024,
  maxParams: 65_535,
  maxRows: 100_000,
} as const;

const db = await PGlite.create(DATA_DIR);

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function handleSql(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/health') {
    return json({ ok: true });
  }

  if (url.pathname !== '/sql' || req.method !== 'POST') {
    return json({ error: 'Not Found' }, 404);
  }

  const cl = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (cl > LIMITS.maxBodyBytes) {
    return json({ error: 'Request body too large' }, 413);
  }

  let body: { sql?: unknown; params?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { sql, params } = body;

  if (typeof sql !== 'string' || sql.length === 0) {
    return json({ error: 'Missing or empty sql field' }, 400);
  }
  if (new TextEncoder().encode(sql).byteLength > LIMITS.maxSqlBytes) {
    return json({ error: 'SQL exceeds 16 MB limit' }, 413);
  }

  const paramArray = Array.isArray(params) ? params : [];
  if (paramArray.length > LIMITS.maxParams) {
    return json({ error: `Params exceed ${LIMITS.maxParams} limit` }, 400);
  }

  try {
    const result = await db.query(
      sql,
      paramArray.length > 0 ? paramArray : undefined,
    );
    const rows = result.rows.slice(0, LIMITS.maxRows);
    return json({
      rows,
      affectedRows: result.affectedRows ?? 0,
      truncated: result.rows.length > LIMITS.maxRows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 400);
  }
}

Bun.serve({ port: SQL_PORT, hostname: HOST, fetch: handleSql });

console.log(`[db] PGlite HTTP on http://${HOST}:${SQL_PORT}`);
console.log(`[db] data: ${DATA_DIR ?? 'in-memory'}`);

const shutdown = async () => {
  console.log('\n[db] shutting down...');
  await db.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
