/**
 * Node worker that hosts PGlite with `--experimental-vm-modules`.
 * Plain CJS so `worker_threads.Worker` can load it without a TS transform.
 */
// @io-wall-ok — worker entry (Node only)

'use strict';

const { parentPort } = require('node:worker_threads');

/** @type {import('@electric-sql/pglite').PGlite | null} */
let db = null;

function bytesToB64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function b64ToBytes(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function bytesAsBlob(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer]);
}

function coercePgParam(value) {
  // SQLite-shaped / Better Auth often send '' for NULL; real Postgres rejects
  // empty strings for timestamptz (and '' is fine as NULL for nullable text).
  if (value === '') return null;
  return value;
}

function coercePgParams(params) {
  if (params === undefined || params === null) return [];
  return params.map(coercePgParam);
}

async function handle(req) {
  switch (req.op) {
    case 'create': {
      const { PGlite } = await import('@electric-sql/pglite');
      if (db !== null) await db.close();
      db =
        req.seedB64 !== undefined
          ? await PGlite.create({
              loadDataDir: bytesAsBlob(b64ToBytes(req.seedB64)),
            })
          : await PGlite.create();
      return { ok: true };
    }
    case 'query': {
      if (db === null) throw new Error('pglite worker: not created');
      const coerced = coercePgParams(req.params);
      const result = await db.query(req.sql ?? '', coerced);
      return {
        rows: result.rows,
        affectedRows: result.affectedRows ?? result.rows.length,
      };
    }
    case 'begin': {
      if (db === null) throw new Error('pglite worker: not created');
      await db.query('BEGIN');
      return { ok: true };
    }
    case 'commit': {
      if (db === null) throw new Error('pglite worker: not created');
      await db.query('COMMIT');
      return { ok: true };
    }
    case 'rollback': {
      if (db === null) throw new Error('pglite worker: not created');
      await db.query('ROLLBACK');
      return { ok: true };
    }
    case 'dump': {
      if (db === null) throw new Error('pglite worker: not created');
      const blob = await db.dumpDataDir('gzip');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { dumpB64: bytesToB64(bytes) };
    }
    case 'replace': {
      const { PGlite } = await import('@electric-sql/pglite');
      if (req.dumpB64 === undefined) {
        throw new Error('pglite worker: replace requires dumpB64');
      }
      if (db !== null) await db.close();
      db = await PGlite.create({
        loadDataDir: bytesAsBlob(b64ToBytes(req.dumpB64)),
      });
      return { ok: true };
    }
    case 'close': {
      if (db !== null) {
        await db.close();
        db = null;
      }
      return { ok: true };
    }
    default:
      throw new Error(`pglite worker: unknown op ${req.op}`);
  }
}

parentPort.on('message', (req) => {
  void handle(req)
    .then((result) => {
      parentPort.postMessage({ id: req.id, result });
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      parentPort.postMessage({ id: req.id, error: message });
    });
});
