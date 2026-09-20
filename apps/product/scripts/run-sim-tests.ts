#!/usr/bin/env bun
// @io-wall-ok — sim test runner CLI entry root (scripts/**).
/**
 * Run each product sim suite in its own `bun test` process, in parallel, under
 * a hard per-file timeout.
 *
 * One `bun test` process over all 46 suites does not work here: every suite
 * boots a whole product (server, clients, sidecars) and the process never
 * gives that memory back, so the run grew past 3.8 GB and 7 minutes before the
 * kernel killed it (exit 137) — while the same suites cost 2-5s each on their
 * own. Isolation is what makes them fast, and it is also what keeps one wedged
 * suite from taking the gate with it.
 */
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
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

/** Hard ceiling per suite. A suite that hits it is a failure, not a retry. */
const DEFAULT_FILE_TIMEOUT_SECONDS = 180;

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name]?.trim() ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * How many suites to run at once.
 *
 * Each one drives a whole product, so the useful cap is cores, not files. The
 * old floor of 2 was wrong on a small machine: PR CI runs on two shared cores,
 * so "half of two, but at least two" put two full sims on two cores. Starved
 * like that, the sim's drain gives up waiting for wall I/O and advances
 * virtual time anyway, and scenarios fail on deadlines that never should have
 * elapsed. Below four cores, run them one at a time — slower than thrashing,
 * but it is the machine that is slow, not the check.
 */
function defaultConcurrency(): number {
  const cores = availableParallelism();
  if (cores < 4) return 1;
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

type Result = {
  readonly file: string;
  readonly seconds: number;
  readonly ok: boolean;
  readonly output: string;
};

function runFile(file: string, timeoutSeconds: number): Promise<Result> {
  const startedAt = Date.now();
  const child = spawn('bun', ['test', ...BUN_TEST_FLAGS, file], {
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
      const seconds = (Date.now() - startedAt) / 1000;
      const output = timedOut
        ? `${chunks.join('')}\nkilled after ${String(timeoutSeconds)}s (run-sim-tests hard timeout)`
        : chunks.join('');
      done({ file, seconds, ok: !timedOut && code === 0, output });
    });
  });
}

/** Run `files` with at most `limit` processes alive at once. */
async function runAll(
  files: readonly string[],
  limit: number,
  timeoutSeconds: number
): Promise<readonly Result[]> {
  const results: Result[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < files.length) {
      const file = files[next++] ?? '';
      const result = await runFile(file, timeoutSeconds);
      results.push(result);
      console.log(
        `${result.ok ? 'pass' : 'FAIL'} ${result.seconds.toFixed(1).padStart(6)}s  ${file}`
      );
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, files.length) }, () => worker())
  );
  return results;
}

function report(results: readonly Result[], wallSeconds: number): number {
  const failed = results.filter((r) => !r.ok);
  for (const failure of failed) {
    console.error(`\n===== ${failure.file} =====\n${failure.output}`);
  }
  const slowest = [...results]
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)
    .map((r) => `${r.file} ${r.seconds.toFixed(1)}s`)
    .join(', ');
  console.log(
    `\nrun-sim-tests: ${String(results.length - failed.length)}/${String(results.length)} suites passed in ${wallSeconds.toFixed(1)}s (slowest: ${slowest})`
  );
  return failed.length === 0 ? 0 : 1;
}

async function main(): Promise<void> {
  const targets = process.argv.slice(2);
  const files = expandTargets(targets.length > 0 ? targets : ['tests']);
  if (files.length === 0) throw new Error('run-sim-tests: no test files');
  const limit = positiveIntEnv('SIM_TEST_CONCURRENCY', defaultConcurrency());
  const timeoutSeconds = positiveIntEnv(
    'SIM_TEST_FILE_TIMEOUT_SECONDS',
    DEFAULT_FILE_TIMEOUT_SECONDS
  );
  console.log(
    `run-sim-tests: ${String(files.length)} suites, ${String(limit)} at a time, ${String(timeoutSeconds)}s each`
  );
  const startedAt = Date.now();
  const results = await runAll(files, limit, timeoutSeconds);
  process.exit(report(results, (Date.now() - startedAt) / 1000));
}

await main();
