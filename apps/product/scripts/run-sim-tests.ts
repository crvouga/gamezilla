#!/usr/bin/env bun
// @io-wall-ok — sim test runner CLI entry root (scripts/**).
/**
 * Run the product sim suites in a few balanced `bun test` processes.
 *
 * Every suite boots a whole product, and the fixed cost of *starting* one of
 * these processes — Babel/Solid transform, module graph, seeded mem fabric —
 * is seconds. Running one process per file paid that 46 times; running them in
 * as many processes as there are usable cores pays it once per core and keeps
 * the same parallelism. All 46 in a single process measured 149s and 873 MB,
 * so batching costs nothing in memory.
 *
 * (An earlier version of this file claimed one process could not hold all the
 * suites, on the evidence of a run that reached 3.8 GB and never finished.
 * That was a livelock in a chess-puzzle scenario spinning and allocating, not
 * a leak across suites; it is fixed, and the claim was wrong.)
 *
 * Each batch runs under a hard timeout, so a wedged suite kills its batch
 * instead of the gate.
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';

const PRODUCT_DIR = resolve(import.meta.dir, '..');

const BUN_TEST_FLAGS = [
  '--conditions=browser',
  '--conditions=development',
  '--preload',
  '@pkgs/bun-test-solid/preload',
  '--preload',
  './bun-preload.ts',
  '--timeout',
  '90000',
] as const;

/** Hard ceiling per batch. A batch that hits it is a failure, not a retry. */
const DEFAULT_BATCH_TIMEOUT_SECONDS = 600;

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name]?.trim() ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * How many batches to run at once.
 *
 * Each batch is one mostly single-threaded process, so the useful cap is
 * cores. PR CI has two; a dev laptop has twelve and does not want all of them
 * taken.
 */
function defaultBatches(): number {
  const cores = availableParallelism();
  // One worker on a two-core box. Turbo is already running another task
  // alongside this one there, so a second sim worker oversubscribes the
  // machine, and a starved sim is not just slow: the scheduler's drain gives
  // up waiting for wall I/O, advances virtual time anyway, and scenarios fail
  // on deadlines that never should have elapsed.
  if (cores <= 2) return 1;
  return Math.max(2, Math.floor(cores / 2));
}

function isTestFile(name: string): boolean {
  return name.endsWith('.test.ts') || name.endsWith('.test.tsx');
}

/** Expand directories to their test files; pass file paths through. */
function expandTargets(targets: readonly string[]): readonly string[] {
  const files = new Set<string>();
  for (const target of targets) {
    const absolute = resolve(PRODUCT_DIR, target);
    if (statSync(absolute).isDirectory()) {
      for (const name of readdirSync(absolute).sort()) {
        if (isTestFile(name)) files.add(join(target, name));
      }
      continue;
    }
    files.add(target);
  }
  return [...files].sort();
}

/**
 * What a suite costs, near enough to balance batches.
 *
 * Booting a product dominates every other thing a scenario does, so count the
 * boots: `openSim` calls, with source size only breaking ties. Size alone put
 * `chess-puzzle-solve-flow` (13 KB, 13 boots) and `chess-puzzle-solve-session`
 * (6 KB, 5 boots) in the wrong order and left the batches 34% apart.
 */
function suiteWeight(file: string): number {
  const absolute = resolve(PRODUCT_DIR, file);
  const source = readFileSync(absolute, 'utf8');
  const boots = source.split('openSim(').length - 1;
  return boots * 100_000 + statSync(absolute).size;
}

/**
 * Boots one process may take on.
 *
 * Both extremes are slow. One process per file pays the startup cost 46 times;
 * one process per core concentrates the heaviest suites, and a batch of the
 * three busiest files measured 180s on its own — a process gets slower the
 * more products it has booted. Small groups fed through a pool amortise
 * startup without letting any one process accumulate.
 */
const MAX_BOOTS_PER_GROUP = 6;

/** Groups in descending weight order, so the pool starts with the heaviest. */
function groupSuites(files: readonly string[]): readonly (readonly string[])[] {
  const weighted = [...files]
    .map((file) => ({ file, weight: suiteWeight(file) }))
    .sort((a, b) => b.weight - a.weight);
  const groups: string[][] = [];
  let current: string[] = [];
  let boots = 0;
  for (const item of weighted) {
    const itemBoots = Math.max(1, Math.floor(item.weight / 100_000));
    if (current.length > 0 && boots + itemBoots > MAX_BOOTS_PER_GROUP) {
      groups.push(current);
      current = [];
      boots = 0;
    }
    current.push(item.file);
    boots += itemBoots;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

type Result = {
  readonly index: number;
  readonly files: readonly string[];
  readonly seconds: number;
  readonly ok: boolean;
  readonly output: string;
};

function runBatch(
  files: readonly string[],
  index: number,
  timeoutSeconds: number
): Promise<Result> {
  const startedAt = Date.now();
  const child = spawn('bun', ['test', ...BUN_TEST_FLAGS, ...files], {
    cwd: PRODUCT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const chunks: string[] = [];
  child.stdout.on('data', (d: Buffer) => chunks.push(d.toString()));
  child.stderr.on('data', (d: Buffer) => chunks.push(d.toString()));

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-(child.pid ?? 0), 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }, timeoutSeconds * 1000);

  return new Promise<Result>((done) => {
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = timedOut
        ? `${chunks.join('')}\nkilled after ${String(timeoutSeconds)}s (run-sim-tests hard timeout)`
        : chunks.join('');
      done({
        index,
        files,
        seconds: (Date.now() - startedAt) / 1000,
        ok: !timedOut && code === 0,
        output,
      });
    });
  });
}

function report(results: readonly Result[], wallSeconds: number): number {
  const failed = results.filter((r) => !r.ok);
  for (const failure of failed) {
    console.error(
      `\n===== group ${String(failure.index + 1)} (${failure.files.length} suites) =====\n${failure.output}`
    );
  }
  const suites = results.reduce((n, r) => n + r.files.length, 0);
  const slowest = Math.max(0, ...results.map((r) => r.seconds));
  console.log(
    `\nrun-sim-tests: ${String(results.length - failed.length)}/${String(results.length)} groups (${String(suites)} suites) passed in ${wallSeconds.toFixed(1)}s (slowest group ${slowest.toFixed(1)}s)`
  );
  return failed.length === 0 ? 0 : 1;
}

async function main(): Promise<void> {
  const targets = process.argv.slice(2);
  const files = expandTargets(targets.length > 0 ? targets : ['tests']);
  if (files.length === 0) throw new Error('run-sim-tests: no test files');
  const batchCount = positiveIntEnv('SIM_TEST_CONCURRENCY', defaultBatches());
  const timeoutSeconds = positiveIntEnv(
    'SIM_TEST_BATCH_TIMEOUT_SECONDS',
    DEFAULT_BATCH_TIMEOUT_SECONDS
  );
  const groups = groupSuites(files);
  console.log(
    `run-sim-tests: ${String(files.length)} suites in ${String(groups.length)} group(s), ${String(batchCount)} at a time, ${String(timeoutSeconds)}s each`
  );
  const startedAt = Date.now();
  const results: Result[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < groups.length) {
      const index = next++;
      results.push(await runBatch(groups[index] ?? [], index, timeoutSeconds));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(batchCount, groups.length) }, () => worker())
  );
  for (const r of results.sort((a, b) => a.index - b.index)) {
    console.log(
      `${r.ok ? 'pass' : 'FAIL'} ${r.seconds.toFixed(1).padStart(6)}s  group ${String(r.index + 1)} (${r.files.length} suites)`
    );
  }
  process.exit(report(results, (Date.now() - startedAt) / 1000));
}

await main();
