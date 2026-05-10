/**
 * Lifecycle helpers for the managed local Postgres cluster: cluster init,
 * postmaster start/wait, graceful stop, and stale-state reconciliation.
 *
 * All shell-outs go through `node:child_process` (no shell strings); paths use
 * `node:path`. Works on macOS, Linux, and WSL.
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { assert } from '@gamezilla/lib/assert';
import type { Logger } from '@gamezilla/lib/logger';
import type { PostgresConfig } from './postgres-config';
import type { ResolvedBinaries } from './postgres-binaries';

/** Result of probing the postmaster.pid for an existing cluster. */
export interface PostmasterProbe {
  readonly state: 'absent' | 'stale' | 'alive';
  readonly pid: number | null;
}

function postmasterPidPath(dataDir: string): string {
  return join(dataDir, 'postmaster.pid');
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    // EPERM means a process exists but we can't signal it (still alive).
    return code === 'EPERM';
  }
}

/**
 * Read `<dataDir>/postmaster.pid` and figure out whether a real postmaster is
 * still running for our cluster. Distinguishes "no file" from "file points at
 * a dead pid" (which is the classic crash-leftover case).
 */
export function probePostmaster(dataDir: string): PostmasterProbe {
  const pidFile = postmasterPidPath(dataDir);
  if (!existsSync(pidFile)) return { state: 'absent', pid: null };
  const raw = (() => {
    try {
      return readFileSync(pidFile, 'utf8');
    } catch {
      return '';
    }
  })();
  const firstLine = raw.split('\n', 1)[0]?.trim() ?? '';
  const pid = Number.parseInt(firstLine, 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    return { state: 'stale', pid: null };
  }
  return isProcessAlive(pid)
    ? { state: 'alive', pid }
    : { state: 'stale', pid };
}

/**
 * Remove a leftover `postmaster.pid` only if the recorded PID is dead. Never
 * touch live clusters; that would corrupt them.
 */
export function reconcileStalePostmaster(dataDir: string, log: Logger): void {
  const probe = probePostmaster(dataDir);
  if (probe.state !== 'stale') return;
  log.warn('removing stale postmaster.pid', {
    dataDir,
    recordedPid: probe.pid,
  });
  try {
    unlinkSync(postmasterPidPath(dataDir));
  } catch (e) {
    log.warn('failed to remove stale postmaster.pid', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** True if the data dir already holds an initialized cluster (PG_VERSION present). */
export function isClusterInitialized(dataDir: string): boolean {
  return existsSync(join(dataDir, 'PG_VERSION'));
}

/**
 * PostgreSQL 17 on macOS refuses to start when the parent process is
 * multithreaded *and* its locale env vars are unset / invalid (the postmaster
 * exits with `postmaster became multithreaded during startup`). Bun's runtime
 * is multithreaded by default, so without explicit locale env we'd reliably
 * fail to start in any shell that doesn't already export `LC_ALL` (most CI
 * boxes, fresh terminals, etc).
 *
 * Fix: ensure `LC_ALL` / `LANG` are set to something valid before spawning any
 * Postgres binary. Defaults to `C` (the always-present POSIX locale); honors
 * any existing values so users can still pin `en_US.UTF-8` etc.
 */
function postgresEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (env['LC_ALL'] === undefined || env['LC_ALL'] === '') env['LC_ALL'] = 'C';
  if (env['LANG'] === undefined || env['LANG'] === '') env['LANG'] = 'C';
  return env;
}

function runSyncInherit(bin: string, args: string[], label: string): void {
  const r = spawnSync(bin, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: postgresEnv(),
  });
  if (r.error) {
    throw new Error(`${label}: ${r.error.message}`);
  }
  if (r.status !== 0) {
    throw new Error(`${label} exited ${String(r.status)}`);
  }
}

/**
 * Initialize the cluster via `initdb`. Idempotent: skips if `PG_VERSION` is
 * already present. Writes the password through a temporary `--pwfile` so it
 * never appears in `ps` output.
 */
export function initClusterIfNeeded(
  binaries: ResolvedBinaries,
  config: PostgresConfig,
  log: Logger
): void {
  if (isClusterInitialized(config.dataDir)) return;
  log.info('initializing cluster', { dataDir: config.dataDir });
  mkdirSync(config.dataDir, { recursive: true });

  const tmp = mkdtempSync(join(tmpdir(), 'gz-pg-pwfile-'));
  const pwfile = join(tmp, 'pwfile');
  writeFileSync(pwfile, config.password, { encoding: 'utf8' });
  try {
    chmodSync(pwfile, 0o600);
  } catch {
    // chmod can fail on Windows filesystems (WSL on /mnt/c). Not fatal.
  }

  try {
    runSyncInherit(
      binaries.paths.initdb,
      [
        '-D',
        config.dataDir,
        '-U',
        config.user,
        '--pwfile',
        pwfile,
        '--auth=scram-sha-256',
        '--encoding',
        config.encoding,
        '--locale',
        config.locale,
      ],
      'initdb'
    );
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; tmp dir will be reaped by the OS.
    }
  }
}

/**
 * Try to stop a managed postmaster identified by PID via `pg_ctl stop -m fast`.
 * Falls back to direct `SIGINT` -> `SIGTERM` -> `SIGKILL` on the recorded PID
 * if `pg_ctl` is unavailable or refuses to act on the data dir.
 *
 * Always scoped to the cluster's own PID — never kills "anything on the
 * port".
 */
export async function stopCluster(
  binaries: ResolvedBinaries,
  config: PostgresConfig,
  log: Logger
): Promise<void> {
  const probe = probePostmaster(config.dataDir);
  if (probe.state === 'absent') {
    log.info('cluster not running (no postmaster.pid)', {
      dataDir: config.dataDir,
    });
    return;
  }
  if (probe.state === 'stale') {
    log.info('cluster not running (stale postmaster.pid); reconciling', {
      dataDir: config.dataDir,
      recordedPid: probe.pid,
    });
    reconcileStalePostmaster(config.dataDir, log);
    return;
  }

  log.info('stopping postgres (fast)', {
    dataDir: config.dataDir,
    pid: probe.pid,
  });

  const ctl = spawnSync(
    binaries.paths.pg_ctl,
    [
      'stop',
      '-D',
      config.dataDir,
      '-m',
      'fast',
      '-w',
      '-t',
      String(Math.max(1, Math.floor(config.shutdownTimeoutMs / 1000))),
    ],
    { stdio: ['ignore', 'inherit', 'inherit'], env: postgresEnv() }
  );
  if (ctl.status === 0) return;

  log.warn('pg_ctl stop failed; escalating signals', {
    status: ctl.status,
    pid: probe.pid,
  });

  if (probe.pid !== null) {
    await escalateSignals(probe.pid, config.shutdownTimeoutMs, log);
  }
}

async function escalateSignals(
  pid: number,
  budgetMs: number,
  log: Logger
): Promise<void> {
  const stages: Array<{ signal: NodeJS.Signals; waitMs: number }> = [
    { signal: 'SIGINT', waitMs: Math.min(2_000, budgetMs / 3) },
    { signal: 'SIGTERM', waitMs: Math.min(5_000, budgetMs / 2) },
    { signal: 'SIGKILL', waitMs: 1_000 },
  ];
  for (const { signal, waitMs } of stages) {
    if (!isProcessAlive(pid)) return;
    log.warn('signaling postmaster', { signal, pid });
    try {
      process.kill(pid, signal);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') return;
      log.warn('signal failed', {
        signal,
        pid,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    const deadline = Date.now() + Math.max(100, waitMs);
    while (Date.now() < deadline) {
      if (!isProcessAlive(pid)) return;
      await sleep(50);
    }
  }
  if (isProcessAlive(pid)) {
    log.error('postmaster still alive after SIGKILL', { pid });
  }
}

export interface StartedPostmaster {
  readonly pid: number;
  /** Resolves when the postmaster exits (any reason). */
  readonly exited: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>;
  /** Stop the wait stream; used during shutdown. */
  readonly close: () => void;
}

function postmasterArgs(config: PostgresConfig): string[] {
  return [
    '-D',
    config.dataDir,
    '-h',
    config.host,
    '-p',
    String(config.port),
    // Disable Unix socket dir so we don't depend on /tmp/.s.PGSQL.<port>
    // permissions (which can collide with system Postgres on shared hosts).
    '-c',
    'unix_socket_directories=',
    '-c',
    'log_min_messages=warning',
    '-c',
    'log_min_error_statement=error',
  ];
}

function forwardLines(
  stream: NodeJS.ReadableStream | null,
  prefix: string
): void {
  if (!stream) return;
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string | Buffer) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.length > 0) process.stdout.write(`${prefix} ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer.length > 0) {
      process.stdout.write(`${prefix} ${buffer}\n`);
      buffer = '';
    }
  });
}

function teeToLogFile(child: ReturnType<typeof spawn>, logFile: string): void {
  // Stream a copy of stdout/stderr to the log file too.
  void import('node:fs').then(({ createWriteStream }) => {
    const sink = createWriteStream(logFile, { flags: 'a' });
    child.stdout?.pipe(sink, { end: false });
    child.stderr?.pipe(sink, { end: false });
  });
}

/**
 * Spawn the postmaster directly so its PID == our child PID (no double-fork).
 * Returns once the OS has accepted the spawn; readiness is verified separately
 * via `pg_isready`. Stdout/stderr are forwarded with a `pg-server:` prefix and
 * appended to the log file for after-the-fact debugging.
 */
export function startPostmaster(
  binaries: ResolvedBinaries,
  config: PostgresConfig,
  logFile: string,
  log: Logger
): StartedPostmaster {
  mkdirSync(join(logFile, '..'), { recursive: true });
  writeFileSync(logFile, '', { encoding: 'utf8' });

  log.info('spawning postmaster', {
    bin: binaries.paths.postgres,
    dataDir: config.dataDir,
    host: config.host,
    port: config.port,
  });

  const child = spawn(binaries.paths.postgres, postmasterArgs(config), {
    env: postgresEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  assert.ok(
    child.pid !== undefined && child.pid !== null,
    'postgres failed to spawn (no pid)'
  );

  teeToLogFile(child, logFile);
  forwardLines(child.stdout, 'pg-server:');
  forwardLines(child.stderr, 'pg-server:');

  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });

  return {
    pid: child.pid,
    exited,
    close: () => {
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
    },
  };
}

/**
 * Block until `pg_isready` reports the cluster is accepting connections. Times
 * out after `config.startupTimeoutMs` and throws, which causes the wrapper to
 * shut down cleanly (the postmaster child is in our process group so it dies
 * with us if we exit without an explicit stop).
 */
export async function waitUntilReady(
  binaries: ResolvedBinaries,
  config: PostgresConfig,
  log: Logger
): Promise<void> {
  const deadline = Date.now() + config.startupTimeoutMs;
  let lastErr = '';
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const r = spawnSync(
      binaries.paths.pg_isready,
      [
        '-h',
        config.host,
        '-p',
        String(config.port),
        '-U',
        config.user,
        '-d',
        config.database,
        '-q',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], env: postgresEnv() }
    );
    if (r.status === 0) {
      log.info('postgres accepting connections', {
        attempts: attempt,
        host: config.host,
        port: config.port,
      });
      return;
    }
    lastErr =
      (r.stderr ?? '').toString().trim() ||
      (r.stdout ?? '').toString().trim() ||
      `pg_isready exit ${String(r.status)}`;
    await sleep(150);
  }
  throw new Error(
    `postgres did not become ready within ${String(config.startupTimeoutMs)}ms (${lastErr})`
  );
}
