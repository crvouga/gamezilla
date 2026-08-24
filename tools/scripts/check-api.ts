#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * API integration check orchestrator: ensures wrangler on :8788 is healthy,
 * then runs `@apps/server` `test:integration`.
 *
 * When `/api/health` is already OK (`bun dev`, `bun preview`, or CI's prior
 * "Start API preview" step), runs tests immediately. Otherwise starts
 * `preview:serve` locally, waits, runs tests, then frees the API port.
 * Deploy / opt-in only (`@apps/server#check:api` in the deploy graph;
 * not part of local `bun check`).
 *
 * Invoked via `bun run check:api` (wraps `secrets-run` for dev secrets).
 */
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';

import { killOrphanEsbuildServices } from '@pkgs/os/kill-orphan-esbuild';
import { killListenersOnPorts } from '@pkgs/os/kill-port';

/** Loopback origin for `wrangler dev` in this repo (`apps/server` uses port 8788). */
const DEFAULT_LOCAL_PREVIEW_API_ORIGIN = 'http://localhost:8788';

const REPO_ROOT = join(import.meta.dirname, '../..');
const API_PORT = Number(new URL(DEFAULT_LOCAL_PREVIEW_API_ORIGIN).port);
const HEALTH_URL = `${DEFAULT_LOCAL_PREVIEW_API_ORIGIN}/api/health`;
const DEFAULT_WAIT_MS = 240_000;
const POLL_MS = 500;

function isCi(): boolean {
  const ci = process.env['CI']?.trim();
  return ci === '1' || ci === 'true';
}

function probeApiHealth(): boolean {
  try {
    const result = spawnSync(
      'curl',
      ['-sf', '--max-time', '2', '-o', '/dev/null', HEALTH_URL],
      { stdio: 'ignore' }
    );
    return result.status === 0;
  } catch {
    return false;
  }
}

function runIntegrationTests(): number {
  const result = spawnSync(
    'bun',
    ['run', '--filter', '@apps/server', 'test:integration'],
    { cwd: REPO_ROOT, stdio: 'inherit', env: process.env }
  );
  return result.status ?? 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApiHealth(
  timeoutMs: number = Number(
    process.env['API_HEALTH_WAIT_MS'] ?? DEFAULT_WAIT_MS
  )
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (probeApiHealth()) {
      process.stdout.write(`[check-api] ready ${HEALTH_URL}\n`);
      return;
    }
    await sleep(POLL_MS);
  }
  throw new Error(
    `[check-api] timed out waiting for ${HEALTH_URL} (${String(timeoutMs)}ms)`
  );
}

function killProcessGroup(pid: number, signal: NodeJS.Signals): void {
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

function startApiPreview(): {
  readonly stop: () => void;
  readonly exited: Promise<number>;
} {
  const logPath = join(REPO_ROOT, '.check-api-preview.log');
  const logFd = openSync(logPath, 'w');
  // Detached = own process group so we can kill wrangler + esbuild together.
  // Do NOT unref — keep a handle and tear the group down in `stop`.
  const child = spawn(
    'bun',
    ['run', '--filter', '@apps/server', 'preview:serve'],
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
      if (process.env['CI']) return;
      const pid = child.pid;
      if (pid !== undefined) {
        killProcessGroup(pid, 'SIGTERM');
        killProcessGroup(pid, 'SIGKILL');
      }
      // Fallback if the group leader already exited but listeners remain.
      killListenersOnPorts([API_PORT, 9231, 9229]);
      killOrphanEsbuildServices({ commandIncludes: REPO_ROOT });
    },
    exited,
  };
}

async function waitForApiOrExit(preview: {
  readonly exited: Promise<number>;
}): Promise<void> {
  await Promise.race([
    waitForApiHealth(),
    preview.exited.then((code) => {
      throw new Error(
        `[check-api] API preview exited early (code ${String(code)}); see .check-api-preview.log`
      );
    }),
  ]);
}

async function main(): Promise<void> {
  if (probeApiHealth()) {
    process.exit(runIntegrationTests());
  }

  if (isCi()) {
    await waitForApiHealth();
    process.exit(runIntegrationTests());
  }

  // Reclaim stale wrangler listeners from prior local check runs.
  killListenersOnPorts([API_PORT, 9231, 9229]);

  process.stdout.write('[check-api] API preview not running — starting…\n');
  const preview = startApiPreview();
  let code = 1;
  try {
    await waitForApiOrExit(preview);
    code = runIntegrationTests();
  } finally {
    preview.stop();
  }
  process.exit(code);
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
