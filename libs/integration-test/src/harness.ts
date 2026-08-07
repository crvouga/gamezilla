import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Subprocess } from 'bun';

import { resolveLocalPreviewApiOrigin } from './local-api-preview';

/** Loopback API Worker origin from the secret store — used by API integration tests. */
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

type SpawnedProcess = {
  readonly subprocess: Subprocess;
  /** Captured combined stdout/stderr — drained continuously so the OS pipe buffers never fill. */
  getOutput(): string;
};

async function drainStreamToBuffer(
  stream: ReadableStream<Uint8Array> | undefined | null,
  label: string,
  buffer: { current: string },
  echo: boolean
): Promise<void> {
  if (!stream) return;
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer.current += chunk;
      if (echo) {
        process.stderr.write(`[${label}] ${chunk}`);
      }
    }
  } catch {
    // ignore — process likely exited
  }
}

/**
 * Spawn a workspace package script via `bun run --filter`, capturing
 * stdout/stderr so failures can be surfaced in CI.
 *
 * We deliberately avoid recursing into `turbo run` here: this harness is
 * itself invoked by turbo integration/e2e tasks, and the inner turbo (with
 * `ui: tui`) fights the outer turbo for the terminal, causing SIGKILL of the
 * test runner. `bun run --filter` runs the script directly in the package
 * without daemon/UI coordination.
 */
function spawnPackageScript(
  packageName: string,
  scriptName: string,
  env: Record<string, string>,
  opts: { echo: boolean }
): SpawnedProcess {
  const subprocess = Bun.spawn(
    ['bun', 'run', '--filter', packageName, scriptName],
    {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    }
  );

  const buffer = { current: '' };
  const label = `${packageName}#${scriptName}`;
  void drainStreamToBuffer(subprocess.stdout, label, buffer, opts.echo);
  void drainStreamToBuffer(subprocess.stderr, label, buffer, opts.echo);

  return {
    subprocess,
    getOutput: () => buffer.current,
  };
}

/** Fail fast when a required server is not already running. */
export async function assertHttpOk(
  url: string,
  opts: {
    readonly label: string;
    readonly startHint: string;
  }
): Promise<void> {
  let lastErr: string | undefined;
  try {
    const res = await fetch(url);
    if (res.ok) return;
    lastErr = `HTTP ${String(res.status)}`;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  throw new Error(
    [
      '',
      '══════════════════════════════════════════════════════════════════',
      `  ${opts.label} is not running`,
      '══════════════════════════════════════════════════════════════════',
      '',
      'Integration tests do not start servers.',
      '',
      `Probe failed: ${url}`,
      `Last error: ${lastErr ?? 'unknown'}`,
      '',
      opts.startHint,
      '',
    ].join('\n')
  );
}

export async function waitForHttpOk(
  url: string,
  opts: {
    timeoutMs: number;
    label: string;
    /** Optional process whose output is included in the timeout error. */
    process?: SpawnedProcess;
  }
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
    if (opts.process && opts.process.subprocess.exitCode !== null) {
      throw new Error(
        `${opts.label}: subprocess exited (${String(
          opts.process.subprocess.exitCode
        )}) before becoming healthy. Output:\n${opts.process.getOutput()}`
      );
    }
    await Bun.sleep(250);
  }
  const procOutput = opts.process
    ? `\nProcess output:\n${opts.process.getOutput()}`
    : '';
  throw new Error(
    `${opts.label}: timed out (${opts.timeoutMs}ms). Last: ${lastErr ?? 'unknown'}${procOutput}`
  );
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
export type PackageScriptHandle = AsyncDisposable & SpawnedProcess;

export function startPackageScriptBackground(
  packageName: string,
  scriptName: string,
  env: Record<string, string>
): PackageScriptHandle {
  const handle = spawnPackageScript(packageName, scriptName, env, {
    echo: false,
  });
  return {
    subprocess: handle.subprocess,
    getOutput: handle.getOutput,
    async [Symbol.asyncDispose]() {
      killSubprocess(handle.subprocess);
    },
  };
}

/** One-shot workspace script (e.g. `setup`, `kill`); throws (with captured output) on non-zero exit. */
export async function runPackageScriptOnce(
  packageName: string,
  scriptName: string,
  env: Record<string, string>
): Promise<void> {
  const handle = spawnPackageScript(packageName, scriptName, env, {
    echo: false,
  });
  const code = await handle.subprocess.exited;
  killSubprocess(handle.subprocess);
  if (code !== 0) {
    throw new Error(
      `bun run --filter ${packageName} ${scriptName} exited ${String(
        code
      )}. Output:\n${handle.getOutput()}`
    );
  }
}
