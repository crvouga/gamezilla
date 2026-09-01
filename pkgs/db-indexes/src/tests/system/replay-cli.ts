#!/usr/bin/env bun
// @io-wall-ok — soak wall budget via INDEXES_SOAK_MS / performance.now
/**
 * Replay a harness seed or soak many seeds.
 *
 *   bun src/tests/system/replay-cli.ts 42
 *   bun src/tests/system/replay-cli.ts --soak
 *
 * Env: INDEXES_SOAK_MS (default 30000), INDEXES_SIM_SEED
 */
import { createSimClock, SimDb } from '../../sim';
import {
  createRng,
  faultScheduleFromSeed,
  runHarness,
} from '../../sim/harness';

async function replaySeed(seed: number): Promise<void> {
  const clock = createSimClock(0);
  const db = new SimDb({
    clock,
    tables: [
      { name: 'notes', estimatedRows: 50_000 },
      { name: 'users', estimatedRows: 50_000 },
    ],
    defaultImprovement: 10,
    faults: faultScheduleFromSeed(seed),
  });
  const result = await runHarness({
    seed,
    db,
    clock,
    tables: ['notes', 'users'],
    cycles: 5,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.violations.length > 0) {
    process.exitCode = 1;
  }
}

async function soak(): Promise<void> {
  const budgetMs = Number(process.env['INDEXES_SOAK_MS'] ?? 30_000);
  const start = performance.now();
  const rng = createRng(1);
  let n = 0;
  let failures = 0;
  while (performance.now() - start < budgetMs) {
    const seed = Math.floor(rng.next() * 1_000_000_000);
    const clock = createSimClock(0);
    const db = new SimDb({
      clock,
      tables: [
        { name: 'notes', estimatedRows: 50_000 },
        { name: 'users', estimatedRows: 50_000 },
      ],
      defaultImprovement: 10,
      faults: faultScheduleFromSeed(seed),
    });
    const result = await runHarness({
      seed,
      db,
      clock,
      tables: ['notes', 'users'],
      cycles: 3,
    });
    n += 1;
    if (result.violations.length > 0) {
      failures += 1;
      console.error('FAIL seed', seed, result.violations);
    }
  }
  console.log(`soak: ${String(n)} seeds, ${String(failures)} failures`);
  if (failures > 0) process.exitCode = 1;
}

const args = process.argv.slice(2);
if (args.includes('--soak')) {
  await soak();
} else {
  const seedArg = args[0] ?? process.env['INDEXES_SIM_SEED'] ?? '42';
  await replaySeed(Number(seedArg));
}
