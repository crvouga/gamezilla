/**
 * Spawn {@link ./pglite-socket.ts} detached so `db:up` returns immediately (like `docker compose up -d`).
 * Waits until the socket accepts TCP so `turbo dev` (API Worker) does not hit a refused connection.
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { waitForTcpPort } from './wait-for-tcp-port';

/**
 * Tiger style (see repo `LLM.md`): validate env-derived host/port before spawn/wait.
 */
const log = createLogger({ name: 'db:dev' });

const srcDir = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(srcDir, '..');
const entry = resolve(srcDir, 'pglite-socket.ts');

function readHost(): string {
  const raw = process.env['PGLITE_HOST']?.trim();
  const host = raw === undefined || raw === '' ? '127.0.0.1' : raw;
  assert.nonEmptyString(host, 'PGLITE_HOST must be a non-empty string', {
    raw,
  });
  return host;
}

function readPort(): number {
  const raw = process.env['PGLITE_PORT']?.trim();
  const s = raw === undefined || raw === '' ? '5432' : raw;
  const n = Number(s);
  assert.integer(
    n,
    `PGLITE_PORT must be an integer (raw: ${JSON.stringify(s)})`
  );
  assert.ok(n >= 1 && n <= 65_535, 'PGLITE_PORT must be in 1..65535', {
    port: n,
  });
  return n;
}

function pgliteDevDbUrl(host: string, port: number): string {
  return `postgres://postgres:postgres@${host}:${String(port)}/postgres?sslmode=disable`;
}

const host = readHost();
const port = readPort();
const dbUrl = pgliteDevDbUrl(host, port);

// #region agent log
const dbgLog = (
  location: string,
  message: string,
  data: Record<string, unknown> = {}
): void => {
  fetch('http://127.0.0.1:7510/ingest/c52c9028-9c01-42a4-9186-01f9b18984a5', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '8e3ce2',
    },
    body: JSON.stringify({
      sessionId: '8e3ce2',
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};
// #endregion

// eslint-disable-next-line max-lines-per-function -- temporary debug instrumentation
async function main(): Promise<void> {
  try {
    await waitForTcpPort(host, port, 500);
    log.info('PGlite (or Postgres) already accepting TCP; skipping spawn', {
      host,
      port,
      dbUrl,
    });
    return;
  } catch {
    /* port not open yet */
  }

  const proc = spawn('bun', ['run', entry], {
    cwd: pkgRoot,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  proc.unref();

  assert.defined(proc.pid, 'failed to start PGlite socket (no pid)', { proc });

  // #region agent log
  dbgLog(
    'apps/db/src/start-background.ts:after-spawn',
    'spawned detached PGlite child',
    {
      hypothesisId: 'A,B',
      pid: proc.pid,
      ppid: process.pid,
      entry,
      cwd: pkgRoot,
      host,
      port,
    }
  );
  // #endregion

  log.info('PGlite socket starting in background', {
    pid: proc.pid,
    host,
    port,
    dbUrl,
  });

  const tWaitStart = Date.now();
  try {
    await waitForTcpPort(host, port, 30_000);
    // #region agent log
    dbgLog(
      'apps/db/src/start-background.ts:wait-success',
      'TCP port became available before timeout',
      {
        hypothesisId: 'A',
        pid: proc.pid,
        elapsedMs: Date.now() - tWaitStart,
      }
    );
    // #endregion
  } catch (error: unknown) {
    // #region agent log
    dbgLog(
      'apps/db/src/start-background.ts:wait-timeout',
      'waitForTcpPort timed out — child may still be initializing PGlite',
      {
        hypothesisId: 'A',
        pid: proc.pid,
        elapsedMs: Date.now() - tWaitStart,
        host,
        port,
        errorMsg: error instanceof Error ? error.message : String(error),
      }
    );
    // #endregion
    log.error('PGlite did not become ready', {
      host,
      port,
      dbUrl,
      error,
    });
    process.exit(1);
  }

  log.info('PGlite ready', {
    host,
    port,
    dbUrl,
    stopHint:
      'bun run --filter @gamezilla/db kill   (kills whatever listens on PGLITE_PORT, default 5432)',
  });
}

await main().catch((error: unknown) => {
  assert.fail('db:dev failed', { error });
});
process.exit(0);
