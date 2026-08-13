import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PathExists } from '@pkgs/system-console';
import type { Subprocess } from 'bun';

function resolveWorkspaceRoot(pathExists: PathExists): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (pathExists(join(dir, 'turbo.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('turbo.json not found when walking up from client test');
    }
    dir = parent;
  }
}

async function drainStreamToBuffer(
  stream: ReadableStream<Uint8Array> | undefined | null,
  buffer: { current: string }
): Promise<void> {
  if (!stream) return;
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer.current += decoder.decode(value, { stream: true });
    }
  } catch {
    // process likely exited
  }
}

function killSubprocess(proc: Subprocess | null): void {
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

/** One-shot workspace script; throws (with captured output) on non-zero exit. */
export async function runPackageScriptOnce(
  packageName: string,
  scriptName: string,
  env: Record<string, string>,
  pathExists: PathExists
): Promise<void> {
  const repoRoot = resolveWorkspaceRoot(pathExists);
  const buffer = { current: '' };
  const subprocess = Bun.spawn(
    ['bun', 'run', '--filter', packageName, scriptName],
    {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  void drainStreamToBuffer(subprocess.stdout, buffer);
  void drainStreamToBuffer(subprocess.stderr, buffer);
  const code = await subprocess.exited;
  killSubprocess(subprocess);
  if (code !== 0) {
    throw new Error(
      `bun run --filter ${packageName} ${scriptName} exited ${String(
        code
      )}. Output:\n${buffer.current}`
    );
  }
}
