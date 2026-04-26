import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SQL_PORT = process.env['SQL_PORT'] ?? '15432';
const LOCAL_DB_HEALTH_URL = `http://127.0.0.1:${SQL_PORT}/health`;
const LOCAL_DB_URL = `http://127.0.0.1:${SQL_PORT}`;

async function waitForHttpOk(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: string | undefined;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastErr = `HTTP ${String(res.status)}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await Bun.sleep(200);
  }
  throw new Error(
    `setup-local-db: local db did not become healthy (${url}). Last: ${lastErr ?? 'unknown'}`
  );
}

async function main(): Promise<void> {
  const server = Bun.spawn(['bun', 'run', 'src/server.ts'], {
    cwd: DB_ROOT,
    env: process.env,
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'inherit',
  });

  try {
    await waitForHttpOk(LOCAL_DB_HEALTH_URL, 30_000);

    const result = spawnSync('bun', ['run', 'scripts/migrate-db.ts'], {
      cwd: DB_ROOT,
      stdio: 'inherit',
      env: { ...process.env, DB_URL: LOCAL_DB_URL },
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0 && result.status !== null) {
      throw new Error(`setup-local-db failed with exit ${result.status}`);
    }
    if (result.signal) {
      throw new Error(`setup-local-db killed by signal ${result.signal}`);
    }
  } finally {
    if (server.exitCode === null) {
      try {
        server.kill('SIGTERM');
      } catch {
        // ignore
      }
      await Promise.race([server.exited, Bun.sleep(2_000)]);
      if (server.exitCode === null) {
        try {
          server.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
    }
  }
}

await main();
