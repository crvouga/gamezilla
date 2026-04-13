/**
 * Dev DB server: PGlite exposed over a tiny HTTP SQL API.
 *
 * PGlite runs in-process (no socket server, no WS proxy). A single
 * `POST /sql` endpoint accepts `{ sql, params? }` and returns rows +
 * metadata. Limits mimic PlanetScale's HTTP API so issues surface locally
 * before hitting production.
 *
 * Invariants (Tiger Style): configuration is asserted at startup; after Zod
 * validates JSON we assert shape bounds before touching PGlite; successful
 * query results are asserted before serializing the response.
 */

import { PGlite } from '@electric-sql/pglite';
import { assert } from '@gamezilla/shared/assert';
import { createLogger } from '@gamezilla/shared/logger';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const sqlBodySchema = z.object({
  sql: z.string().min(1, 'sql field must be non-empty'),
  params: z.array(z.unknown()).max(65_535).optional(),
});

/** PlanetScale HTTP API limits — worst-case sizes are fixed here, not derived from runtime input alone. */
const LIMITS = {
  maxBodyBytes: 16 * 1024 * 1024,
  maxSqlBytes: 16 * 1024 * 1024,
  maxRows: 100_000,
  maxParams: 65_535,
} as const;

const HOST = '127.0.0.1';
const DATA_DIR = process.env['GAMEZILLA_DATA_DIR'];

const log = createLogger({ name: 'db' });

/**
 * Precondition: `SQL_PORT` env (if set) must be a decimal string in 1…65535.
 * Misconfiguration crashes the process — fail loudly at startup, not mid-request.
 */
function parseListenPortFromEnv(): number {
  const raw = process.env['SQL_PORT'] ?? '15432';
  const port = Number.parseInt(raw, 10);
  assert.ok(
    Number.isFinite(port) && port >= 1 && port <= 65_535,
    'SQL_PORT must be a valid TCP port (1–65535)',
    { raw, port }
  );
  return port;
}

const SQL_PORT = parseListenPortFromEnv();

/**
 * Untrusted header: invalid or absurd values yield `null` so the handler can
 * respond 400 without treating malformed client input as an internal invariant violation.
 */
function parseContentLengthBytes(header: string | undefined): number | null {
  if (header === undefined || header === '') {
    return 0;
  }
  const n = Number.parseInt(header, 10);
  if (Number.isNaN(n)) {
    return null;
  }
  if (n < 0 || !Number.isSafeInteger(n)) {
    return null;
  }
  return n;
}

function sqlByteLength(sql: string): number {
  return new TextEncoder().encode(sql).byteLength;
}

type PgliteQueryResult = {
  rows: Record<string, unknown>[];
  affectedRows?: number;
};

/**
 * Postcondition: PGlite returns a rows array and a non-negative integral affected row count.
 */
function assertQueryResultShape(
  result: unknown
): asserts result is PgliteQueryResult {
  assert.record(result, 'query result must be an object');
  assert.field(result, 'rows', 'query result must have rows');
  assert.array(result.rows, 'query result.rows must be an array');
  assert.nonNegativeInteger(
    result.rows.length,
    'query result.rows.length must be a non-negative safe integer'
  );
  if (result.affectedRows !== undefined) {
    assert.nonNegativeInteger(
      result.affectedRows,
      'query result.affectedRows must be a non-negative safe integer when present'
    );
  }
}

const db = await PGlite.create(DATA_DIR);

const app = new Hono()
  .get('/health', (c) => c.json({ ok: true }))
  .post('/sql', zValidator('json', sqlBodySchema), async (c) => {
    const contentLengthBytes = parseContentLengthBytes(
      c.req.header('content-length')
    );
    if (contentLengthBytes === null) {
      return c.json({ error: 'Invalid Content-Length' }, 400);
    }
    if (contentLengthBytes > LIMITS.maxBodyBytes) {
      return c.json({ error: 'Request body too large' }, 413);
    }

    const { sql, params: rawParams } = c.req.valid('json');

    // Zod already enforced non-empty sql and param count; restate as load-bearing invariants before PGlite.
    assert.nonEmptyString(sql, 'validated JSON must include non-empty sql');
    const paramArray = rawParams ?? [];
    assert.array(paramArray, 'params must be an array when present');
    assert.ok(
      paramArray.length <= LIMITS.maxParams,
      'param count must not exceed schema max',
      { length: paramArray.length, max: LIMITS.maxParams }
    );

    const sqlBytes = sqlByteLength(sql);
    if (sqlBytes > LIMITS.maxSqlBytes) {
      return c.json({ error: 'SQL exceeds 16 MB limit' }, 413);
    }

    const start = performance.now();
    let rawResult: unknown;
    try {
      rawResult = await db.query(
        sql,
        paramArray.length > 0 ? paramArray : undefined
      );
    } catch (err) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const message = err instanceof Error ? err.message : String(err);
      log.error('query failed', {
        sql,
        params: paramArray.length > 0 ? paramArray : undefined,
        error: message,
        durationMs,
      });
      return c.json({ error: 'Query execution failed' }, 400);
    }

    // Invariant violations past this point crash (Assert.crash) — not confused with SQL errors.
    assertQueryResultShape(rawResult);

    const rowCount = rawResult.rows.length;
    const rows = rawResult.rows.slice(0, LIMITS.maxRows);
    assert.ok(
      rows.length <= rowCount && rows.length <= LIMITS.maxRows,
      'slice must not grow row set or exceed configured cap',
      { sliced: rows.length, rowCount, cap: LIMITS.maxRows }
    );

    const affectedRows = rawResult.affectedRows ?? 0;
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    log.info('query ok', {
      sql,
      params: paramArray.length > 0 ? paramArray : undefined,
      rows: rows.length,
      affectedRows,
      durationMs,
    });
    return c.json({
      rows,
      affectedRows,
      truncated: rowCount > LIMITS.maxRows,
    });
  })
  .notFound((c) => c.json({ error: 'Not Found' }, 404));

Bun.serve({ port: SQL_PORT, hostname: HOST, fetch: app.fetch });

log.info('server started', {
  host: HOST,
  port: SQL_PORT,
  dataDir: DATA_DIR ?? 'in-memory',
});

const shutdown = async (signal: string) => {
  log.info('shutting down', { signal });
  try {
    await db.close();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('db.close failed', { error: message });
    process.exit(1);
  }
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
