// @io-wall-ok

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { wallClock, wallTimers } from '@pkgs/clock';

/**
 * Local `wrangler dev` for preview/check with short-startup retries.
 *
 * Under ephemeral-port pressure (many TIME_WAIT sockets from other local
 * stacks), wrangler fails at startup with
 * `connect EADDRNOTAVAIL 127.0.0.1:<inspector>`. Fail fast with a clear
 * message when TIME_WAIT is extreme; otherwise retry a couple of times.
 */

const API_DIR = join(import.meta.dirname, '..');
const API_PORT = 8788;
const INSPECTOR_PORT = 9231;
const MAX_ATTEMPTS = 3;
const RETRY_MS = 1_500;
const FAST_FAIL_MS = 8_000;
/** Above this, local TCP binds for wrangler inspector almost always fail. */
const BLOCKING_TIME_WAIT = 10_000;

const children: ChildProcess[] = [];
let shuttingDown = false;

function killChild(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode !== null || child.killed) return;
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    // Negative PID = process group (spawned detached so wrangler + esbuild die together).
    process.kill(-pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // already gone
    }
  }
}

function shutdown(exitCode: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killChild(child, 'SIGTERM');
  wallTimers.setTimeout(() => {
    for (const child of children) killChild(child, 'SIGKILL');
    process.exit(exitCode);
  }, 2_000);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    const codes: Record<string, number> = {
      SIGHUP: 129,
      SIGINT: 130,
      SIGTERM: 143,
    };
    shutdown(codes[sig] ?? 1);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => wallTimers.setTimeout(resolve, ms));
}

function countTcpTimeWait(): number {
  try {
    const result = spawnSync('netstat', ['-an', '-p', 'tcp'], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.status !== 0 || typeof result.stdout !== 'string') return 0;
    let count = 0;
    for (const line of result.stdout.split('\n')) {
      if (line.includes('TIME_WAIT')) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

function assertEphemeralPortsAvailable(): void {
  const timeWait = countTcpTimeWait();
  if (timeWait < BLOCKING_TIME_WAIT) return;
  throw new Error(
    [
      `[preview-serve] ephemeral ports exhausted (TIME_WAIT=${String(timeWait)}).`,
      'Stop other local stacks that open many TCP sockets (e.g. another monorepo',
      '`turbo dev` / Redis / Electron apps), wait ~30s for TIME_WAIT to drain,',
      'then retry `bun preview` / `bun run --filter @apps/server check:api`.',
    ].join(' ')
  );
}

type WranglerRun = {
  readonly code: number;
  readonly elapsedMs: number;
};

function runWranglerOnce(): Promise<WranglerRun> {
  const startedAt = wallClock.now();
  return new Promise((resolve) => {
    const child = spawn(
      'wrangler',
      [
        'dev',
        '--port',
        String(API_PORT),
        '--inspector-port',
        String(INSPECTOR_PORT),
      ],
      {
        cwd: API_DIR,
        stdio: 'inherit',
        // New process group so shutdown can SIGTERM/SIGKILL wrangler + its esbuild children.
        detached: true,
      }
    );
    children.push(child);
    child.on('exit', (code) => {
      // Reap the process group so a crashed wrangler cannot leave esbuild behind.
      const pid = child.pid;
      if (pid !== undefined) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          // group already gone
        }
      }
      resolve({ code: code ?? 1, elapsedMs: wallClock.now() - startedAt });
    });
  });
}

assertEphemeralPortsAvailable();

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  if (shuttingDown) process.exit(1);
  const { code, elapsedMs } = await runWranglerOnce();
  if (code === 0 || shuttingDown) process.exit(code);
  const retryable = elapsedMs < FAST_FAIL_MS && attempt < MAX_ATTEMPTS;
  if (!retryable) process.exit(code);
  process.stderr.write(
    `[preview-serve] wrangler exited in ${String(elapsedMs)}ms (code ${String(code)}); retry ${String(attempt)}/${String(MAX_ATTEMPTS)}…\n`
  );
  assertEphemeralPortsAvailable();
  await sleep(RETRY_MS);
}
