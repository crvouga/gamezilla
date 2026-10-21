// @io-wall-ok — restore the plan and the prerequisite cache artifacts a shard needs.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { restorePlan } from './verify-plan-transfer';
import type { VerifyPlan } from './verify-shards';
import { requiredTasks } from './verify-stage-cache';

const ROOT = join(import.meta.dirname, '../../..');
if (import.meta.main) {
  restorePlan(
    readFileSync(join(ROOT, '.cache/verify-ci/plan.payload'), 'utf8')
  );
  const plan = JSON.parse(
    readFileSync(join(ROOT, '.cache/verify-ci/plan.json'), 'utf8')
  ) as VerifyPlan;
  const shard = plan.shards[Number(process.env['VERIFY_SHARD'])]!;
  const own = new Set(shard.tasks.map((task) => task.taskId));
  if (requiredTasks(plan, shard.tasks).some((task) => !own.has(task.taskId))) {
    const prerequisite = plan.shards.find(
      (task) => task.stage === 'prerequisites'
    )!;
    execFileSync(
      'bun',
      [
        'run',
        'libs/tools-harness-ts/scripts/verify-artifact-download.ts',
        `verify-evidence-${prerequisite.index}`,
        join(ROOT, '.cache/verify-ci/transfers'),
        'prerequisites',
      ],
      { cwd: ROOT, stdio: 'inherit' }
    );
  }
}
