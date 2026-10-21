// @io-wall-ok — bounded aggregation/publication after independent producers finish.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { turboChildEnv } from './turbo-ci-run';
import { restorePlan } from './verify-plan-transfer';
import { reportCommand } from './verify-report-command';
import { missingReports } from './verify-report-evidence';
import { restoreReportOutputs } from './verify-report-restore';
import type { VerifyPlan } from './verify-shards';
import { executes, imbalance } from './verify-shards';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/verify-ci');

function shardResults(plan: VerifyPlan) {
  return plan.shards.flatMap((shard) => {
    try {
      return [
        JSON.parse(
          readFileSync(
            join(DIRECTORY, 'results', `shard-${shard.index}.json`),
            'utf8'
          )
        ) as {
          index: number;
          actualMs: number;
          verdict: number;
          hits: number;
        },
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
  ) as VerifyPlan;
  const env = turboChildEnv();
  const reportPlan = join(DIRECTORY, 'reports.json');
  env['VERIFY_REPORT_PLAN_PATH'] = reportPlan;
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
      'libs/tools-harness-ts/scripts/verify-artifact-download.ts',
      'verify-evidence-',
      join(DIRECTORY, 'transfers'),
      'reports',
    ],
    { cwd: ROOT, env, stdio: 'inherit' }
  );
  const results = shardResults(plan);
  // Balance is a property of the verify shards that ran, not of cached ones.
  const ran = results.filter((result) => {
    const shard = plan.shards[result.index];
    return shard?.stage === 'verifications' && executes(shard);
  });
  const skew = ran.length ? imbalance(ran.map((result) => result.actualMs)) : 0;
  console.log(
    `actual shard imbalance ${(skew * 100).toFixed(1)}%; ${results.reduce((sum, result) => sum + result.hits, 0)}/${plan.tasks.length} hits`
  );
  if (skew > 0.1)
    console.warn(
      '::warning::Actual shard imbalance exceeds 10%; the next plan packs by the durations this run measured'
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
