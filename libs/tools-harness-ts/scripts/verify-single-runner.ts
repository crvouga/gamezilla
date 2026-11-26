// @io-wall-ok — run the deployment plan in the planner's checkout.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifySchedule } from './verify-plan-schedule';
import { deploymentTools } from './verify-plan-transfer';
import { runShard } from './verify-shard-run';
import { type VerifyPlan, validatePlan } from './verify-shards';

export function singleRunnerStages(plan: VerifyPlan): readonly number[] {
  validatePlan(plan);
  const schedule = verifySchedule(plan);
  if (schedule.shards.length > 1)
    throw new Error('Parallel shards require separate runners');
  const prerequisites = plan.shards.find(
    (shard) => shard.stage === 'prerequisites'
  )!;
  const consumers = plan.shards.find((shard) => shard.stage === 'consumers')!;
  return [
    prerequisites.index,
    ...schedule.shards,
    ...(schedule.consumers ? [consumers.index] : []),
  ];
}

if (import.meta.main) {
  const path = join(import.meta.dirname, '../../../.cache/verify-ci/plan.json');
  const plan = JSON.parse(readFileSync(path, 'utf8')) as VerifyPlan;
  const stages = singleRunnerStages(plan);
  execFileSync('mise', ['install', ...deploymentTools(plan.tasks).split(' ')], {
    stdio: 'inherit',
  });
  for (const index of stages) {
    const status = await runShard(index, false);
    if (status !== 0) process.exit(status);
  }
}
