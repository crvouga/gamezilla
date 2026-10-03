// @io-wall-ok — restore prior stage evidence and exact cache artifacts.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { restorePlan } from './check-plan-transfer';
import type { CheckPlan } from './check-shards';
import { requiredTasks } from './check-stage-cache';

const ROOT = join(import.meta.dirname, '../../..');
if (import.meta.main) {
  restorePlan(process.env['CHECK_PLAN_PAYLOAD']!);
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
        ],
        { cwd: ROOT, stdio: 'inherit' }
      );
    }
  }
  if (!existsSync(directory)) process.exit(0);
  for (const name of readdirSync(directory).filter((name) =>
    /^evidence-\d+\.tar$/.test(name)
  ))
    execFileSync('tar', ['-xf', join(directory, name), '-C', ROOT]);
}
