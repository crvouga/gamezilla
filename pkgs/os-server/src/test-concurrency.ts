// @io-wall-ok — Bun test flag CLI; callers inject the environment into the resolver.
import { availableParallelism, totalmem } from 'node:os';

const GIB = 1024 * 1024 * 1024;
/** Leave this much RAM for the OS, Quint, and the report writer. */
const WORKER_RESERVE_BYTES = 8 * GIB;
/** One product world, measured near 1.7GB RSS on a spec worker. */
const WORKER_BYTES = 2 * GIB;
/** Hard cap so a large machine does not start one world per core. */
const WORKER_CAP = 16;

/** Explicit limits lower the caller's existing concurrency ceiling. */
export function testConcurrency(env: NodeJS.ProcessEnv, fallback = 20): number {
  if (!Number.isSafeInteger(fallback) || fallback < 1)
    throw new Error('Test concurrency ceiling must be a positive integer');
  const value = env['VERIFY_TEST_CONCURRENCY']?.trim();
  if (!value) return fallback;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error('VERIFY_TEST_CONCURRENCY must be a positive integer');
  return Math.min(fallback, count);
}

/**
 * How many spec workers this machine can hold. Each worker is one product
 * world. Two cores stay free for Quint and the OS. `VERIFY_TEST_CONCURRENCY`
 * can only lower the result.
 */
export function specWorkerCeiling(cpus: number, totalBytes: number): number {
  if (!Number.isSafeInteger(cpus) || cpus < 1)
    throw new Error('CPU count must be a positive integer');
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 1)
    throw new Error('Memory size must be a positive integer');
  const byCpu = Math.max(1, cpus - 2);
  const spare = Math.max(0, totalBytes - WORKER_RESERVE_BYTES);
  const byMem = Math.max(1, Math.floor(spare / WORKER_BYTES));
  return Math.min(WORKER_CAP, byCpu, byMem);
}

/** Spec worker count for this process: machine ceiling, then the env cap. */
export function specParallelism(env: NodeJS.ProcessEnv): number {
  return testConcurrency(
    env,
    specWorkerCeiling(availableParallelism(), totalmem())
  );
}

if (import.meta.main)
  process.stdout.write(
    `${testConcurrency(process.env, Number(process.argv[2] ?? '20'))}\n`
  );
