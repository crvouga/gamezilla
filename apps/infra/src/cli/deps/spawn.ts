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

function parseSemverFromString(s: string): string | null {
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  const match = SEMVER_REGEX.exec(trimmed);
  return match ? match[0] : null;
}

/**
 * Resolve a binary's version via `<bin> <args>`. Reads stdout first; falls
 * back to stderr because some CLIs (notably wrangler) print `--version` to
 * stderr in non-TTY contexts.
 */
export function captureVersion(bin: string, args: string[]): string | null {
  try {
    const r = spawnSync(bin, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    if (r.error) return null;
    const stdout = (r.stdout ?? '').toString();
    const stderr = (r.stderr ?? '').toString();
    return (
      parseSemverFromString(stdout) ??
      parseSemverFromString(stderr) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Like {@link captureVersion} but returns rich diagnostics on failure so
 * the caller can include stdout/stderr/status in error messages — useful
 * when CI shows an opaque "could not determine version".
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
      parseSemverFromString(stdout) ?? parseSemverFromString(stderr) ?? null;
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
