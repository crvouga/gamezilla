#!/usr/bin/env bun
// @io-wall-ok — composition root

/**
 * API integration verification orchestrator: ensures wrangler on :8788 is healthy,
 * then runs `@apps/server-ts` `test:integration`.
 *
 * When `/api/health` is already OK (`bun dev`), runs tests
 * immediately. Otherwise starts `serve:api`, waits, runs tests, then
 * frees the API port. Self-contained for CI and local — the deploy turbo
 * graph no longer has a separate "Start API" workflow step.
 *
 * Release only (`@apps/server-ts#verify:api` in the deploy graph; not part of
 * `bun verify`).
 *
 * Invoked via `bun run --filter @apps/server-ts verify:api` under `secrets-run`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { killOrphanEsbuildServices } from '@pkgs/dev-owner-server-ts/kill-orphan-esbuild';

/** Loopback origin for `wrangler dev` in this repo (`apps/server-ts` uses port 8788). */
const DEFAULT_LOCAL_PREVIEW_API_ORIGIN = 'http://localhost:8788';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const HEALTH_URL = `${DEFAULT_LOCAL_PREVIEW_API_ORIGIN}/api/health`;
const API_LOG_PATH = join(REPO_ROOT, '.verify-api.log');
const DEFAULT_WAIT_MS = 240_000;
const POLL_MS = 500;

/** Like `curl -sf --max-time 2`: any response below 400 within 2 s is healthy. */
async function probeApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, {
      redirect: 'manual',
      signal: AbortSignal.timeout(2000),
    });
    await response.body?.cancel();
    return response.status < 400;
  } catch {
    return false;
  }
}

function runIntegrationTests(): number {
  const result = spawnSync(
    'bun',
    ['run', '--filter', '@apps/server-ts', 'test:integration'],
    { cwd: REPO_ROOT, stdio: 'inherit', env: process.env }
  );
  return result.status ?? 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readApiLogTail(maxLines = 200): string {
  if (!existsSync(API_LOG_PATH)) return '';
  try {
    const text = readFileSync(API_LOG_PATH, { encoding: 'utf8' });
    const lines = text.split('\n');
    return lines.slice(-maxLines).join('\n').trimEnd();
  } catch {
    return '';
  }
}

function formatApiLog(): string {
  const tail = readApiLogTail();
  return tail.length > 0
    ? `\n--- ${API_LOG_PATH} (last 200 lines) ---\n${tail}`
    : `\n(API log empty or missing: ${API_LOG_PATH})`;
}

async function waitForApiHealth(
  timeoutMs: number = Number(
    process.env['API_HEALTH_WAIT_MS'] ?? DEFAULT_WAIT_MS
  )
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeApiHealth()) {
      process.stdout.write(`[verify-api] ready ${HEALTH_URL}\n`);
      return;
    }
    await sleep(POLL_MS);
  }
  throw new Error(
    `[verify-api] timed out waiting for ${HEALTH_URL} (${String(timeoutMs)}ms)${formatApiLog()}`
  );
}

function killProcessGroup(pid: number, signal: NodeJS.Signals): void {
  if (process.platform === 'win32') {
    // No process groups on Windows: `taskkill /T` walks the tree by parent pid
    // and `/F` is the only stop a console process tree honors.
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

function startApi(): {
  readonly stop: () => void;
  readonly exited: Promise<number>;
} {
  const logFd = openSync(API_LOG_PATH, 'w');
  // Detached = own process group so we can kill wrangler + esbuild together.
  // Do NOT unref — keep a handle and tear the group down in `stop`.
  const child = spawn(
    'bun',
    ['run', '--filter', '@apps/server-ts', 'serve:api'],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: process.env,
    }
  );
  closeSync(logFd);
  const exited = new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1));
  });
  return {
    stop: () => {
      const pid = child.pid;
      if (pid !== undefined) {
        killProcessGroup(pid, 'SIGTERM');
        killProcessGroup(pid, 'SIGKILL');
      }
      // Fallback if the group leader already exited but listeners remain.
      killOrphanEsbuildServices({ commandIncludes: REPO_ROOT });
    },
    exited,
  };
}

async function waitForApiOrExit(api: {
  readonly exited: Promise<number>;
}): Promise<void> {
  await Promise.race([
    waitForApiHealth(),
    api.exited.then((code) => {
      throw new Error(
        `[verify-api] API exited early (code ${String(code)}); see ${API_LOG_PATH}${formatApiLog()}`
      );
    }),
  ]);
}

async function main(): Promise<void> {
  if (await probeApiHealth()) {
    process.exit(runIntegrationTests());
  }

  // Reclaim stale wrangler listeners from prior local / CI verify runs.

  process.stdout.write('[verify-api] API not running — starting…\n');
  const api = startApi();
  let code = 1;
  try {
    await waitForApiOrExit(api);
    code = runIntegrationTests();
  } finally {
    api.stop();
  }
  process.exit(code);
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
