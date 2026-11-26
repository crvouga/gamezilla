// @io-wall-ok — run the deployment plan in the planner's checkout.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deploymentTools } from './verify-plan-transfer';
import { runShard } from './verify-shard-run';
import { type VerifyPlan, validatePlan } from './verify-shards';

if (import.meta.main) {
  const path = join(import.meta.dirname, '../../../.cache/verify-ci/plan.json');
  const plan = JSON.parse(readFileSync(path, 'utf8')) as VerifyPlan;
  validatePlan(plan);
  if (plan.shards.length !== 1)
    throw new Error(
      'The planning runner requires a single-shard deployment plan'
    );
  if (process.argv.includes('--install-tools')) {
    execFileSync(
      'mise',
      ['install', ...deploymentTools(plan.tasks).split(' ')],
      {
        stdio: 'inherit',
      }
    );
    process.exit(0);
  }
  process.exit(await runShard(0, false));
}
