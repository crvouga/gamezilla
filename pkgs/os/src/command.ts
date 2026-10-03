import { spawnSync } from 'node:child_process';
import { currentPlatform } from './platform';

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
}

export interface CaptureResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
}

/** True if `bin` exists on PATH (`where` on Windows, `which` elsewhere). */
export function which(bin: string): boolean {
  return whichPath(bin) !== null;
}

/**
 * Absolute path to the first `bin` on PATH, or null if missing.
 * Uses `where` on Windows (first line) and `which` elsewhere.
 */
export function whichPath(bin: string): string | null {
  const cmd = currentPlatform() === 'win32' ? 'where' : 'which';
  const r = spawnSync(cmd, [bin], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  if (r.status !== 0 || r.error) return null;
  const first = (r.stdout ?? '')
    .toString()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return first ?? null;
}

/**
 * Run a command, inheriting stdio.
 * Throws on non-zero exit or spawn error.
 */
export function run(
  cmd: string,
  args: readonly string[],
  opts: RunOptions = {}
): void {
  const r = spawnSync(cmd, [...args], {
    stdio: 'inherit',
    env: opts.env ?? process.env,
    ...(opts.timeoutMs === undefined
      ? {}
      : { timeout: opts.timeoutMs, killSignal: 'SIGKILL' }),
    ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
  });
  if (r.status !== 0 || r.error) {
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${r.status ?? 'with error'}`
    );
  }
}

/** Capture stdout/stderr/status; never throws. */
export function capture(
  cmd: string,
  args: readonly string[],
  opts: RunOptions = {}
): CaptureResult {
  try {
    const r = spawnSync(cmd, [...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: opts.env ?? process.env,
      ...(opts.timeoutMs === undefined
        ? {}
        : { timeout: opts.timeoutMs, killSignal: 'SIGKILL' }),
      ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
    });
    return {
      stdout: (r.stdout ?? '').toString(),
      stderr: (r.stderr ?? '').toString(),
      status: r.status,
    };
  } catch (e) {
    return {
      stdout: '',
      stderr: e instanceof Error ? e.message : String(e),
      status: null,
    };
  }
}
