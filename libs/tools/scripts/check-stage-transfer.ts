// @io-wall-ok — restore prior stage evidence and exact cache artifacts.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { restorePlan } from './check-plan-transfer';
import type { CheckPlan } from './check-shards';
import { requiredTasks } from './check-stage-cache';

const ROOT = join(import.meta.dirname, '../../..');
if (import.meta.main) {
  restorePlan(readFileSync(join(ROOT, '.cache/check-ci/plan.payload'), 'utf8'));
  const directory = join(ROOT, '.cache/check-ci/transfers');
  if (process.argv.includes('--prerequisites')) {
    const plan = JSON.parse(
      readFileSync(join(ROOT, '.cache/check-ci/plan.json'), 'utf8')
    ) as CheckPlan;
    const shard = plan.shards[Number(process.env['CHECK_SHARD'])]!;
    const own = new Set(shard.tasks.map((task) => task.taskId));
    if (
      requiredTasks(plan, shard.tasks).some((task) => !own.has(task.taskId))
    ) {
      const prerequisite = plan.shards.find(
        (task) => task.stage === 'prerequisites'
      )!;
      execFileSync(
        'bun',
        [
          'run',
          'libs/tools/scripts/check-artifact-download.ts',
          `check-evidence-${prerequisite.index}`,
          directory,
          'prerequisites',
        ],
        { cwd: ROOT, stdio: 'inherit' }
      );
    }
  }
}
