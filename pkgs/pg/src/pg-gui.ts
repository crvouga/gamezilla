/**
 * pgweb sidecar lifecycle for `@pkgs/pg dev`.
 *
 * Runs the [pgweb](https://github.com/sosedoff/pgweb) HTTP GUI as a foreground
 * child of the wrapper, pre-connected to the local cluster. Same orphan-
 * prevention invariants as the postmaster:
 *
 * - spawned in our process group (no detach), so an abrupt wrapper exit also
 *   kills pgweb,
 * - stopped explicitly during `dev.ts` shutdown so we don't rely solely on
 *   process-group SIGHUP,
 * - non-fatal if it fails to start — the cluster is the contract, the GUI is a
 *   developer convenience.
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Logger } from '@pkgs/logger';

const HOMEBREW_PREFIXES = ['/opt/homebrew/bin', '/usr/local/bin'];

function isWindows(): boolean {
  return process.platform === 'win32';
}

function exeName(name: string): string {
  return isWindows() ? `${name}.exe` : name;
}

/** True if `bin` exists on PATH (cross-platform; uses `where` on Windows). */
function whichSync(bin: string): boolean {
  const cmd = isWindows() ? 'where' : 'which';
  const r = spawnSync(cmd, [bin], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  return r.status === 0 && !r.error;
}

function platformInstallHint(): string {
  if (process.platform === 'darwin') {
    return 'Install with `brew install pgweb` (or set PG_GUI_BIN to a custom path).';
  }
  if (process.platform === 'linux') {
    return 'Install pgweb from https://github.com/sosedoff/pgweb/releases (or set PG_GUI_BIN).';
  }
  if (process.platform === 'win32') {
    return 'Run dev inside WSL2 and install pgweb in the WSL distro (see https://github.com/sosedoff/pgweb).';
  }
  return 'Install pgweb (https://github.com/sosedoff/pgweb) and ensure it is on PATH or set PG_GUI_BIN.';
}

/**
 * Resolve the pgweb binary. Returns `null` (with a warning logged) when not
 * found — `dev.ts` treats that as "skip the GUI sidecar" rather than failing
 * the cluster boot.
 */
export function resolvePgwebBinary(
  override: string | null,
  log: Logger
): string | null {
  if (override !== null) {
    if (existsSync(override)) return override;
    log.warn('PG_GUI_BIN does not exist; falling back to PATH lookup', {
      override,
    });
  }
  if (whichSync(exeName('pgweb'))) return exeName('pgweb');
  for (const prefix of HOMEBREW_PREFIXES) {
    const candidate = `${prefix}/${exeName('pgweb')}`;
    if (existsSync(candidate)) return candidate;
  }
  log.warn('pgweb not found; skipping GUI sidecar', {
    hint: platformInstallHint(),
  });
  return null;
}

export interface StartedGui {
  readonly pid: number;
  readonly url: string;
  /** Resolves when pgweb exits (any reason). */
  readonly exited: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>;
  /**
   * Stop pgweb. Idempotent + single-flight. Sends SIGTERM, escalates to
   * SIGKILL after `timeoutMs` if needed.
   */
  readonly stop: (timeoutMs: number) => Promise<void>;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return code === 'EPERM';
  }
}

export interface StartPgwebInput {
  readonly binary: string;
  readonly dbUrl: string;
  readonly host: string;
  readonly port: number;
  readonly logFile: string;
  readonly log: Logger;
}

/**
 * Spawn pgweb directly. Stdout/stderr are forwarded with a `pg-gui:` prefix
 * (visible in turbo dev's TUI) and tee'd to `logFile` for after-the-fact
 * debugging.
 */
export function startPgweb(input: StartPgwebInput): StartedGui {
  const { binary, dbUrl, host, port, logFile, log } = input;
  mkdirSync(dirname(logFile), { recursive: true });
  writeFileSync(logFile, '', { encoding: 'utf8' });

  const args = [
    '--bind',
    host,
    '--listen',
    String(port),
    '--url',
    dbUrl,
    '--skip-open',
  ];

  log.info('spawning pgweb', { binary, host, port });

  const child = spawn(binary, args, {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  if (child.pid === undefined || child.pid === null) {
    throw new Error('pgweb failed to spawn (no pid)');
  }

  const sink = createWriteStream(logFile, { flags: 'a' });
  child.stdout?.pipe(sink, { end: false });
  child.stderr?.pipe(sink, { end: false });

  forwardLines(child.stdout, 'pg-gui:');
  forwardLines(child.stderr, 'pg-gui:');

  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });

  return {
    pid: child.pid,
    url: `http://${host}:${String(port)}`,
    exited,
    stop: makeStop(child.pid, log),
  };
}

/** Single-flight stop: SIGTERM, wait, escalate to SIGKILL. */
function makeStop(
  pid: number,
  log: Logger
): (timeoutMs: number) => Promise<void> {
  let stopPromise: Promise<void> | null = null;
  return (timeoutMs: number): Promise<void> => {
    stopPromise ??= stopOnce(pid, timeoutMs, log);
    return stopPromise;
  };
}

async function stopOnce(
  pid: number,
  timeoutMs: number,
  log: Logger
): Promise<void> {
  if (!isProcessAlive(pid)) return;
  log.info('stopping pgweb', { pid, signal: 'SIGTERM' });
  if (!sendSignal(pid, 'SIGTERM', log)) return;
  const deadline = Date.now() + Math.max(100, timeoutMs);
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return;
    await sleep(50);
  }
  if (!isProcessAlive(pid)) return;
  log.warn('pgweb did not exit; escalating to SIGKILL', { pid });
  sendSignal(pid, 'SIGKILL', log);
}

/** Returns false when the target process is already gone (no follow-up needed). */
function sendSignal(pid: number, signal: NodeJS.Signals, log: Logger): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false;
    log.warn(`pgweb ${signal} failed`, {
      pid,
      error: e instanceof Error ? e.message : String(e),
    });
    return true;
  }
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
