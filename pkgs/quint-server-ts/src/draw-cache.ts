// @io-wall-ok — shares one Quint draw across spec workers via the filesystem.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const WAIT_SLICES = 1800;
const SLEEP_MS = 100;
const ITF = 'itf';
const FAILED = 'failed.txt';
/** Bump when the cached files change shape, so an old draw is not reused. */
const DRAW_CACHE_VERSION = '1';

export type QuintDrawCache = {
  readonly source: string;
  readonly seed: string;
  readonly traces: number;
  readonly maxSteps: number;
  readonly produce: (dir: string) => void;
};

/**
 * Directory of deduped `.itf.json` files. One Quint process wins; the rest
 * wait, and share its failure. A later caller draws again.
 */
export function cachedQuintDir(draw: QuintDrawCache): string {
  const dir = join(cacheRoot(), drawKey(draw));
  if (existsSync(join(dir, 'ready'))) return join(dir, ITF);
  const produced = tryProduce(dir, draw.produce);
  if (produced !== null) return produced;
  return waitForDraw(dir, draw.produce);
}

function cacheRoot(): string {
  const report = process.env['HARNESS_REPORT_DIR'];
  if (report !== undefined && report.length > 0)
    return join(dirname(dirname(report)), 'quint-draws');
  return join(tmpdir(), 'quint-draws');
}

function drawKey(draw: QuintDrawCache): string {
  return createHash('sha256')
    .update(DRAW_CACHE_VERSION)
    .update('\0')
    .update(draw.source)
    .update('\0')
    .update(draw.seed)
    .update('\0')
    .update(String(draw.traces))
    .update('\0')
    .update(String(draw.maxSteps))
    .digest('hex');
}

function readFailed(dir: string): string | null {
  const path = join(dir, FAILED);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function tryProduce(
  dir: string,
  produce: (itfDir: string) => void
): string | null {
  const lock = join(dir, 'lock');
  mkdirSync(dir, { recursive: true });
  // A failure only answers the callers waiting on the draw that failed. One
  // already here when this caller arrives was left by an earlier producer,
  // possibly an earlier run of older code on this machine (the cache key is
  // checkout-independent), and would otherwise fail this draw for good.
  rmSync(join(dir, FAILED), { force: true });
  try {
    mkdirSync(lock);
  } catch (error) {
    if (errorCode(error) === 'EEXIST') return null;
    throw error;
  }
  const itf = join(dir, ITF);
  try {
    writeFileSync(join(lock, 'pid'), String(process.pid));
    removeTree(itf);
    mkdirSync(itf, { recursive: true });
    produce(itf);
    writeFileSync(join(dir, 'ready'), '');
    return itf;
  } catch (error) {
    writeFileSync(
      join(dir, FAILED),
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  } finally {
    removeTree(lock, { whenLocked: 'leave' });
  }
}

function waitForDraw(dir: string, produce: (itfDir: string) => void): string {
  const ready = join(dir, 'ready');
  const lock = join(dir, 'lock');
  for (let slice = 0; slice < WAIT_SLICES; slice++) {
    if (existsSync(ready)) return join(dir, ITF);
    const failed = readFailed(dir);
    if (failed !== null) throw new Error(failed);
    if (!existsSync(lock) || lockIsDead(lock)) break;
    Bun.sleepSync(SLEEP_MS);
  }
  if (existsSync(ready)) return join(dir, ITF);
  const failed = readFailed(dir);
  if (failed !== null) throw new Error(failed);
  if (existsSync(lock) && lockIsDead(lock)) removeTree(lock);
  const produced = tryProduce(dir, produce);
  if (produced !== null) return produced;
  throw new Error(`quint draw cache timed out waiting for ${dir}`);
}

function lockIsDead(lock: string): boolean {
  try {
    const pid = Number(readFileSync(join(lock, 'pid'), 'utf8'));
    if (!Number.isSafeInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return errorCode(error) === 'ESRCH';
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
