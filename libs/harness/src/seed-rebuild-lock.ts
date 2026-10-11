// @io-wall-ok — one cross-process rebuild of a harness seed. Waiters sleep on the wall.
import { join } from 'node:path';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';

type Fs = ReturnType<typeof wallNodeFs>;

const WAIT_SLICES = 600;
const SLEEP_MS = 50;

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pidAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return codeOf(error) !== 'ESRCH';
  }
}

async function holderAlive(fs: Fs, lock: string): Promise<boolean> {
  try {
    const text = await fs.readFile(join(lock, 'pid'), 'utf8');
    return pidAlive(Number(text));
  } catch (error) {
    return codeOf(error) !== 'ENOENT';
  }
}

async function tryAcquire(fs: Fs, lock: string): Promise<boolean> {
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if (codeOf(error) !== 'EEXIST') throw error;
    return false;
  }
  try {
    await fs.writeFile(join(lock, 'pid'), String(process.pid));
    return true;
  } catch (error) {
    if (codeOf(error) !== 'ENOENT') throw error;
    return false;
  }
}

async function acquire(fs: Fs, lock: string): Promise<void> {
  for (let slice = 0; slice < WAIT_SLICES; slice++) {
    if (await tryAcquire(fs, lock)) return;
    if (!(await holderAlive(fs, lock))) {
      await fs.rm(lock, { recursive: true, force: true });
      continue;
    }
    await pause(SLEEP_MS);
  }
  throw new Error(`seed rebuild lock timed out waiting for ${lock}`);
}

/** Run `fn` while this process is the only one rebuilding `seedKey`. */
export async function withSeedRebuildLock<T>(
  cacheDir: string,
  seedKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const fs = wallNodeFs();
  const lock = join(cacheDir, `${seedKey}.lock`);
  await acquire(fs, lock);
  try {
    return await fn();
  } finally {
    await fs.rm(lock, { recursive: true, force: true });
  }
}
