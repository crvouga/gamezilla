// @io-wall-ok — cross-process lock files bound machine-wide solver processes.
/**
 * Machine-wide cap on model proofs in flight, shared by every `check:models`
 * task Turbo runs at once. Turbo has one `--concurrency` for all tasks, so
 * bounding Apalache / TLC through it starved hundreds of single-core lint,
 * typecheck and spec tasks to protect eleven model-check tasks. Instead the
 * solver takes a slot here and Turbo keeps the remaining cores.
 *
 * A slot is an exclusive lock file (`slot-<n>`) holding its owner's pid under
 * `$TMPDIR/check-solver-slots` (private per `bun check-pr` run; Turbo
 * passes `TMPDIR` through); a slot whose owner died is reclaimed.
 */
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';

export const SOLVER_SLOTS_DIR_ENV = 'CHECK_SOLVER_SLOTS_DIR';
export const SOLVER_SLOTS_ENV = 'CHECK_SOLVER_SLOTS';
const POLL_MS = 250;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function tryClaim(path: string): boolean {
  try {
    const fd = openSync(path, 'wx');
    writeSync(fd, String(process.pid));
    closeSync(fd);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  let owner = Number.NaN;
  try {
    owner = Number(readFileSync(path, 'utf8'));
  } catch {
    return false;
  }
  if (Number.isInteger(owner) && owner > 0 && alive(owner)) return false;
  try {
    unlinkSync(path);
  } catch {
    // Another waiter reclaimed it first.
  }
  return false;
}

async function acquire(dir: string, slots: number): Promise<string> {
  mkdirSync(dir, { recursive: true });
  for (;;) {
    for (let index = 0; index < slots; index++) {
      const path = join(dir, `slot-${String(index)}`);
      if (tryClaim(path)) return path;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/**
 * Proofs in flight machine-wide: one per three cores, at most four. Model work
 * is ~1100 s of mostly single-core solver time with a 330 s longest proof
 * (`matching.qnt`); two slots cannot fit it inside the 600 s run deadline.
 */
export function solverSlots(
  env: NodeJS.ProcessEnv = process.env,
  cpus: number = availableParallelism()
): number {
  const fromEnv = Number(env[SOLVER_SLOTS_ENV]);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  return Math.min(4, Math.max(1, Math.floor(cpus / 3)));
}

/** Run `work` holding one machine-wide solver slot; waiting is not timed. */
export async function withSolverSlot<T>(
  work: () => Promise<T>,
  env: NodeJS.ProcessEnv = process.env
): Promise<T> {
  const dir =
    env[SOLVER_SLOTS_DIR_ENV]?.trim() ||
    join(env['TMPDIR'] ?? tmpdir(), 'check-solver-slots');
  const path = await acquire(dir, solverSlots(env));
  const release = () => {
    try {
      unlinkSync(path);
    } catch {
      // Already released.
    }
  };
  process.once('exit', release);
  try {
    return await work();
  } finally {
    process.removeListener('exit', release);
    release();
  }
}
