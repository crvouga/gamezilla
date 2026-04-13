/**
 * Dev DB server: PGlite exposed over a tiny HTTP SQL API.
 *
 * PGlite runs in-process (no socket server, no WS proxy). A single
 * `POST /sql` endpoint accepts `{ sql, params? }` and returns rows +
 * metadata. Limits mimic PlanetScale's HTTP API so issues surface locally
 * before hitting production.
 */

import { PGlite } from '@electric-sql/pglite';
import { createLogger } from '@gamezilla/shared/logger';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const sqlBodySchema = z.object({
  sql: z.string().min(1, 'sql field must be non-empty'),
  params: z.array(z.unknown()).max(65_535).optional(),
});

const SQL_PORT_RAW = process.env['SQL_PORT'] ?? '15432';
const SQL_PORT = parseInt(SQL_PORT_RAW, 10);
if (Number.isNaN(SQL_PORT) || SQL_PORT <= 0 || SQL_PORT > 65_535) {
  throw new Error(
    `SQL_PORT must be a valid port number (1–65535), got: ${JSON.stringify(SQL_PORT_RAW)}`
  );
}
const HOST = '127.0.0.1';
const DATA_DIR = process.env['GAMEZILLA_DATA_DIR'];

// PlanetScale HTTP API limits
const LIMITS = {
  maxBodyBytes: 16 * 1024 * 1024,
  maxSqlBytes: 16 * 1024 * 1024,
  maxRows: 100_000,
} as const;

const log = createLogger({ name: 'db' });

const db = await PGlite.create(DATA_DIR);

const app = new Hono()
  .get('/health', (c) => c.json({ ok: true }))
  .post('/sql', zValidator('json', sqlBodySchema), async (c) => {
    const cl = parseInt(c.req.header('content-length') ?? '0', 10);
    if (cl > LIMITS.maxBodyBytes) {
      return c.json({ error: 'Request body too large' }, 413);
    }

    const { sql, params: rawParams } = c.req.valid('json');

    if (new TextEncoder().encode(sql).byteLength > LIMITS.maxSqlBytes) {
      return c.json({ error: 'SQL exceeds 16 MB limit' }, 413);
    }

    const paramArray = rawParams ?? [];

    const start = performance.now();
    try {
      const result = await db.query(
        sql,
        paramArray.length > 0 ? paramArray : undefined
      );
      const rows = result.rows.slice(0, LIMITS.maxRows);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      log.info('query ok', {
        sql,
        params: paramArray.length > 0 ? paramArray : undefined,
        rows: rows.length,
        affectedRows: result.affectedRows ?? 0,
        durationMs,
      });
      return c.json({
        rows,
        affectedRows: result.affectedRows ?? 0,
        truncated: result.rows.length > LIMITS.maxRows,
      });
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
  })
  .notFound((c) => c.json({ error: 'Not Found' }, 404));

Bun.serve({ port: SQL_PORT, hostname: HOST, fetch: app.fetch });

log.info('server started', {
  host: HOST,
  port: SQL_PORT,
  dataDir: DATA_DIR ?? 'in-memory',
});

const shutdown = async () => {
  log.info('shutting down');
  await db.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
