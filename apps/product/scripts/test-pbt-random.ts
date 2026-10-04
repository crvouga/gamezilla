#!/usr/bin/env bun
/**
 * Run property tests (*.test.ts that use fast-check / assertProperty) with random seeds.
 *
 *   bun run test:pbt:random                  # single suite run (200 runs/property)
 *   bun run test:pbt:random 100              # up to 100 attempts; stop on first fail
 *   bun run test:pbt:random --concurrency 8  # cap parallel file workers
 *
 * On failure (local only): plays a sound + shows a system dialog. Disable with
 * PBT_FAIL_LOUD=0. Skipped automatically when CI=true.
 */
import { availableParallelism } from 'node:os';

import { discoverPbtTests } from './discover';
import { notifyPbtFailure } from './notify-failure';
import {
  DEFAULT_NUM_RUNS,
  DEFAULT_SAMPLE_INTERRUPT_MS,
  REPO_ROOT,
  runPbtSuite,
} from './run-suite';
import { randomAttemptSeed } from './seed';
import { PbtSessionUi } from './ui';

type Cli = {
  readonly attempts: number;
  readonly concurrency: number;
};

function parseConcurrency(raw: string | undefined): number {
  if (raw === undefined || raw.length === 0) {
    const cpus = availableParallelism();
    return Math.max(1, Math.min(6, cpus));
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('concurrency must be a positive integer');
  }
  return n;
}

function parseCli(argv: ReadonlyArray<string>): Cli {
  let attempts = 1;
  let concurrency = parseConcurrency(process.env['PBT_CONCURRENCY']);

  const positional: string[] = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--concurrency' || arg === '-j') {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error(`${arg} requires a number`);
      }
      concurrency = parseConcurrency(next);
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg?.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    }
    if (typeof arg === 'string') {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    const n = Number.parseInt(positional[0] ?? '', 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error('attempts must be a positive integer');
    }
    attempts = n;
  }

  return { attempts, concurrency };
}

function printUsage(): void {
  console.error(`usage: bun run test:pbt:random [attempts] [--concurrency N]

  attempts       independent suite runs (default 1); stops on first failure
  --concurrency  parallel file workers (default: min(6, CPU count), or PBT_CONCURRENCY)
`);
}

async function main(): Promise<void> {
  let cli: Cli;
  try {
    cli = parseCli(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }

  const files = await discoverPbtTests(REPO_ROOT);
  if (files.length === 0) {
    console.error('no property tests found under pkgs/ or libs/');
    process.exit(1);
  }

  const ui = new PbtSessionUi({
    totalFiles: files.length,
    concurrency: cli.concurrency,
    numRuns: DEFAULT_NUM_RUNS,
    attempts: cli.attempts,
  });
  ui.startSession();

  for (let attempt = 1; attempt <= cli.attempts; attempt += 1) {
    const seed = randomAttemptSeed();
    ui.beginAttempt(attempt, seed);
    const result = await runPbtSuite({
      repoRoot: REPO_ROOT,
      files,
      concurrency: cli.concurrency,
      seed,
      numRuns: DEFAULT_NUM_RUNS,
      sampleInterruptMs: DEFAULT_SAMPLE_INTERRUPT_MS,
      ui,
    });
    if (!result.ok) {
      ui.stopSession();
      notifyPbtFailure({
        seed,
        failedFiles: result.results
          .filter((r) => r.code !== 0)
          .map((r) => r.file),
      });
      process.exit(1);
    }
  }

  ui.stopSession();
}

main().catch((error) => {
  console.error(error);
  notifyPbtFailure({ seed: 0, failedFiles: [] });
  process.exit(1);
});
