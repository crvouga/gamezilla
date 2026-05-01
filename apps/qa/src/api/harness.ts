import type { Subprocess } from 'bun';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveLocalPreviewApiOrigin } from '../constants/local-api-preview';

/** Loopback API Worker origin from Doppler — used by API integration tests. */
export async function resolveLocalApiOrigin(): Promise<string> {
  return resolveLocalPreviewApiOrigin();
}

function resolveWorkspaceRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(join(dir, 'turbo.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('turbo.json not found when walking up from harness');
    }
    dir = parent;
  }
}

const repoRoot = resolveWorkspaceRoot();

/** Port for `@gamezilla/db` PGlite HTTP server (fixed in apps/db; Doppler `local` `DB_URL` must match). */
export function defaultSqlPort(): string {
  return '15432';
}

export function databaseHttpOrigin(port: string): string {
  return `http://127.0.0.1:${port}`;
}

/**
 * Runs a workspace package script via `bun run --filter`.
 *
 * We deliberately avoid recursing into `turbo run` here: this harness is itself
 * invoked by `turbo run qa`, and Bun's `bun:test` runner gets killed with
 * SIGKILL when the inner `turbo` (with `ui: tui`) tries to attach to the
 * terminal already owned by the outer turbo. `bun run --filter` runs the
 * script directly in the package without the daemon/UI coordination.
 */
function spawnPackageScript(
  packageName: string,
  scriptName: string,
  env: Record<string, string>
): Subprocess {
  return Bun.spawn(
    ['bun', 'run', '--filter', packageName, scriptName],
    {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
    }
  );
}

export async function waitForHttpOk(
  url: string,
  opts: { timeoutMs: number; label: string }
): Promise<void> {
  const deadline = Date.now() + opts.timeoutMs;
  let lastErr: string | undefined;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastErr = `HTTP ${String(res.status)}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await Bun.sleep(250);
  }
  throw new Error(`${opts.label}: timed out (${opts.timeoutMs}ms). Last: ${lastErr ?? 'unknown'}`);
}

export function killSubprocess(proc: Subprocess | null): void {
  if (proc === null || proc.exitCode !== null) return;
  try {
    proc.kill('SIGTERM');
  } catch {
    // ignore
  }
  try {
    proc.kill('SIGKILL');
  } catch {
    // ignore
  }
}

/** Long-running workspace script (e.g. `preview`); use with `await using` for teardown. */
export type PackageScriptHandle = AsyncDisposable & {
  readonly subprocess: Subprocess;
};

export function startPackageScriptBackground(
  packageName: string,
  scriptName: string,
  env: Record<string, string>
): PackageScriptHandle {
  const subprocess = spawnPackageScript(packageName, scriptName, env);
  return {
    subprocess,
    async [Symbol.asyncDispose]() {
      killSubprocess(subprocess);
    },
  };
}

/** One-shot workspace script (e.g. `setup`, `kill`); throws on non-zero exit. */
export async function runPackageScriptOnce(
  packageName: string,
  scriptName: string,
  env: Record<string, string>
): Promise<void> {
  const proc = spawnPackageScript(packageName, scriptName, env);
  const code = await proc.exited;
  killSubprocess(proc);
  if (code !== 0) {
    throw new Error(
      `bun run --filter ${packageName} ${scriptName} exited ${String(code)}`
    );
  }
}
