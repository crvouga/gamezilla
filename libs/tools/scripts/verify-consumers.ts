// @io-wall-ok — CI fan-in entry; runs the consumers stage after its producers.
/**
 * The fan-in stage of `verify:end`: a task that reads several shards' outputs
 * runs here, after every shard, on the cache artifacts its producers
 * transferred. A stage the plan left nothing to execute does nothing; its
 * cached verdict was recorded by `verify:start`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { restorePlan } from './verify-plan-transfer';
import { runShard } from './verify-shard-run';
import type { VerifyPlan } from './verify-shards';
import { executes } from './verify-shards';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/verify-ci');

async function runConsumers(): Promise<number> {
  restorePlan(readFileSync(join(DIRECTORY, 'plan.payload'), 'utf8'));
  const plan = JSON.parse(
    readFileSync(join(DIRECTORY, 'plan.json'), 'utf8')
  ) as VerifyPlan;
  const consumers = plan.shards.find((shard) => shard.stage === 'consumers')!;
  if (!executes(consumers)) {
    console.log('consumers: nothing to execute');
    return 0;
  }
  execFileSync(
    'bun',
    [
      'run',
      'libs/tools/scripts/verify-artifact-download.ts',
      'verify-evidence-',
      join(DIRECTORY, 'transfers'),
      'consumers',
    ],
    { cwd: ROOT, stdio: 'inherit' }
  );
  return runShard(consumers.index);
}

if (import.meta.main) process.exit(await runConsumers());
