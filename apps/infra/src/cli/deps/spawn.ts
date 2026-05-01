import { spawnSync } from 'node:child_process';

/** True if `bin` exists on PATH (cross-platform; uses `where` on Windows). */
export function whichSync(bin: string): boolean {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'where' : 'which';
  const r = spawnSync(cmd, [bin], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  return r.status === 0 && !r.error;
}

const SEMVER_REGEX = /[\d]+\.[\d]+[\w.+-]*/;

/**
 * Extracts a version from `--version` stdout. Stricter than a free regex
 * scan: requires the FIRST non-empty line to contain a semver, which avoids
 * false positives from error messages embedding version numbers (e.g.
 * "Wrangler requires at least Node.js v22.0.0").
 */
function parseVersionFromStdout(s: string): string | null {
  const lines = s.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  const match = SEMVER_REGEX.exec(lines[0]!);
  return match ? match[0] : null;
}

/** Resolve a binary's version via `<bin> <args>`. Returns null on non-zero exit or unparseable output. */
export function captureVersion(bin: string, args: string[]): string | null {
  const d = captureVersionDiagnostic(bin, args);
  return d.version;
}

/**
 * Like {@link captureVersion} but returns rich diagnostics so callers can
 * surface stdout/stderr/status in error messages — useful when CI shows an
 * opaque "could not determine version".
 *
 * Version detection is intentionally strict: we ONLY accept a semver from
 * stdout's first line and ONLY when the process exited 0. Treating stderr
 * as a fallback misidentifies error-message version numbers as the binary's
 * version (e.g. wrangler 4.x on Node 20 prints "Wrangler requires at least
 * Node.js v22.0.0" to stderr).
 */
export function captureVersionDiagnostic(
  bin: string,
  args: string[]
): { version: string | null; stdout: string; stderr: string; status: number | null } {
  try {
    const r = spawnSync(bin, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    const stdout = (r.stdout ?? '').toString();
    const stderr = (r.stderr ?? '').toString();
    const version =
      r.status === 0 && !r.error ? parseVersionFromStdout(stdout) : null;
    return { version, stdout, stderr, status: r.status };
  } catch (e) {
    return {
      version: null,
      stdout: '',
      stderr: e instanceof Error ? e.message : String(e),
      status: null,
    };
  }
}

export function spawnInstall(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0 || r.error) {
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${r.status ?? 'with error'}`
    );
  }
}

export function verifyRun(bin: string, args: string[]): void {
  const r = spawnSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  if (r.status !== 0 || r.error) {
    const stderr = (r.stderr ?? '').toString().trim();
    const stdout = (r.stdout ?? '').toString().trim();
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    throw new Error(`${bin} ${args.join(' ')} exited ${r.status}`);
  }
}
