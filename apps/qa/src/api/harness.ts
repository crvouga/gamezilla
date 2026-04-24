import type { Subprocess } from 'bun';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Matches {@link apps/client/scripts/setup-env.ts} default for local API. */
export const LOCAL_API_ORIGIN = 'http://127.0.0.1:8788';

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

export function defaultSqlPort(): string {
  return process.env['API_HEALTH_TEST_SQL_PORT'] ?? '18765';
}

export function databaseHttpOrigin(port: string): string {
  return `http://127.0.0.1:${port}`;
}

/** Runs `turbo run …` from the monorepo root (no hardcoded `apps/*` paths). */
export function spawnTurbo(
  taskAndFilter: readonly string[],
  env: Record<string, string>
): Subprocess {
  return Bun.spawn(['bunx', 'turbo', 'run', ...taskAndFilter], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdout: 'ignore',
    stderr: 'ignore',
    stdin: 'ignore',
  });
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

/** Long-running `turbo run` (e.g. preview); use with `await using` for teardown. */
export type TurboBackgroundHandle = AsyncDisposable & {
  readonly subprocess: Subprocess;
};

export function startTurboBackground(
  taskAndFilter: readonly string[],
  env: Record<string, string>
): TurboBackgroundHandle {
  const subprocess = spawnTurbo(taskAndFilter, env);
  return {
    subprocess,
    async [Symbol.asyncDispose]() {
      killSubprocess(subprocess);
    },
  };
}

/** One-shot `turbo run` that should exit (e.g. setup); throws on non-zero exit. */
export async function runTurboOnce(
  taskAndFilter: readonly string[],
  env: Record<string, string>
): Promise<void> {
  const proc = spawnTurbo(taskAndFilter, env);
  const code = await proc.exited;
  killSubprocess(proc);
  if (code !== 0) {
    throw new Error(
      `turbo run ${taskAndFilter.join(' ')} exited ${String(code)}`
    );
  }
}
