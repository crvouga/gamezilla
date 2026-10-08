// @io-wall-ok — bounded aggregation/publication after independent producers finish.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { restorePlan } from './check-plan-transfer';
import { reportCommand } from './check-report-command';
import { missingReports } from './check-report-evidence';
import { restoreReportOutputs } from './check-report-restore';
import type { CheckPlan } from './check-shards';
import { imbalance } from './check-shards';
import { turboChildEnv } from './turbo-ci-run';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/check-ci');

function shardResults(plan: CheckPlan) {
  return plan.shards.flatMap((shard) => {
    try {
      return [
        JSON.parse(
          readFileSync(
            join(DIRECTORY, 'results', `shard-${shard.index}.json`),
            'utf8'
          )
        ) as { actualMs: number; verdict: number; hits: number },
      ];
    } catch {
      return [];
    }
  });
}

async function publish(): Promise<void> {
  restorePlan(readFileSync(join(DIRECTORY, 'plan.payload'), 'utf8'));
  const plan = JSON.parse(
    readFileSync(join(DIRECTORY, 'plan.json'), 'utf8')
  ) as CheckPlan;
  const env = turboChildEnv();
  const reportPlan = join(DIRECTORY, 'reports.json');
  env['CHECK_REPORT_PLAN_PATH'] = reportPlan;
  writeFileSync(
    reportPlan,
    JSON.stringify({ generation: 0, tasks: plan.tasks })
  );
  await reportCommand(ROOT, env, ['prepare']);
  // Drain and release each archive's bounded publication pool before downloading the next.
  const transferred = spawnSync(
    'bun',
    [
      'run',
      'libs/tools/scripts/check-artifact-download.ts',
      'check-evidence-',
      join(DIRECTORY, 'transfers'),
      'reports',
    ],
    { cwd: ROOT, env, stdio: 'inherit' }
  );
  const results = shardResults(plan);
  const skew = imbalance(results.map((result) => result.actualMs));
  console.log(
    `actual shard imbalance ${(skew * 100).toFixed(1)}%; ${results.reduce((sum, result) => sum + result.hits, 0)}/${plan.tasks.length} hits`
  );
  if (skew > 0.1)
    console.warn(
      '::warning::Actual shard imbalance exceeds 10%; harvest these timings before the next run'
    );
  let failed =
    transferred.status !== 0 ||
    results.length !== plan.shards.length ||
    results.some((result) => result.verdict !== 0);
  try {
    await restoreReportOutputs({
      ids: missingReports(env),
      plan,
      root: ROOT,
      env,
      request: fetch,
      publish: (id) => reportCommand(ROOT, env, ['task', id]),
    });
  } catch (error) {
    failed = true;
    console.error(error);
  }
  await reportCommand(ROOT, env, ['close', ...(failed ? ['failed'] : [])]);
}

if (import.meta.main) await publish();
