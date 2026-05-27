import { spawnSync } from 'node:child_process';
import { currentPlatform } from './platform';

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface CaptureResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
}

export interface CaptureVersionDiagnostic {
  readonly version: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
}

const SEMVER_REGEX = /[\d]+\.[\d]+[\w.+-]*/;

/** True if `bin` exists on PATH (`where` on Windows, `which` elsewhere). */
export function which(bin: string): boolean {
  const cmd = currentPlatform() === 'win32' ? 'where' : 'which';
  const r = spawnSync(cmd, [bin], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  return r.status === 0 && !r.error;
}

/**
 * Run a command, inheriting stdio so install progress streams to the user.
 * Throws on non-zero exit or spawn error so callers can fall through to the
 * next strategy.
 */
export function run(
  cmd: string,
  args: readonly string[],
  opts: RunOptions = {}
): void {
  const r = spawnSync(cmd, [...args], {
    stdio: 'inherit',
    env: opts.env ?? process.env,
    ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
  });
  if (r.status !== 0 || r.error) {
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${r.status ?? 'with error'}`
    );
  }
}

/** Like {@link run} but returns true/false instead of throwing. */
export function runOk(
  cmd: string,
  args: readonly string[],
  opts: RunOptions = {}
): boolean {
  const r = spawnSync(cmd, [...args], {
    stdio: 'ignore',
    env: opts.env ?? process.env,
    ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
  });
  return r.status === 0 && !r.error;
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

/**
 * Like {@link run} but echoes captured stdout/stderr on failure. Useful for
 * post-install verification probes (e.g. `pgweb --version`) where a clean
 * "ENOENT" tells the user more than a 2KB strace.
 */
export function verifyRun(bin: string, args: readonly string[]): void {
  const r = capture(bin, args);
  if (r.status === 0) return;
  if (r.stdout.trim()) console.error(r.stdout.trim());
  if (r.stderr.trim()) console.error(r.stderr.trim());
  throw new Error(`${bin} ${args.join(' ')} exited ${String(r.status)}`);
}

/**
 * Stricter than a free regex scan: requires the FIRST non-empty line of
 * stdout to contain a semver. Prevents false positives from error messages
 * that embed version numbers (e.g. "Wrangler requires Node.js v22.0.0").
 */
function parseVersionFromStdout(s: string): string | null {
  const lines = s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  const first = lines[0];
  if (first === undefined) return null;
  const match = SEMVER_REGEX.exec(first);
  return match ? match[0] : null;
}

/** Resolve a binary's version via `<bin> <args>`. Null on non-zero or unparseable. */
export function captureVersion(
  bin: string,
  args: readonly string[]
): string | null {
  return captureVersionDiagnostic(bin, args).version;
}

/**
 * Like {@link captureVersion} but surfaces stdout/stderr/status so callers
 * can include them in error messages — opaque "could not determine version"
 * is much less actionable in CI than the actual probe output.
 */
export function captureVersionDiagnostic(
  bin: string,
  args: readonly string[]
): CaptureVersionDiagnostic {
  const r = capture(bin, args);
  const version =
    r.status === 0 ? parseVersionFromStdout(r.stdout) : null;
  return { version, stdout: r.stdout, stderr: r.stderr, status: r.status };
}
