// @io-wall-ok — separate, nonessential aggregation/publication job.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { restoreReportOutputs } from './check-report-restore';
import { type CheckPlan, imbalance } from './check-shards';
import { turboChildEnv } from './turbo-ci-run';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/check-ci');
const env = turboChildEnv();
const plan = JSON.parse(
  readFileSync(join(DIRECTORY, 'plan.json'), 'utf8')
) as CheckPlan;
const reportPlan = join(DIRECTORY, 'reports.json');
env['CHECK_REPORT_PLAN_PATH'] = reportPlan;
writeFileSync(reportPlan, JSON.stringify({ generation: 0, tasks: plan.tasks }));

function command(args: string[]): void {
  const result = spawnSync(
    'bun',
    ['run', 'libs/harness/scripts/report-publish.ts', ...args],
    { cwd: ROOT, env, stdio: 'inherit' }
  );
  if (result.status !== 0)
    throw new Error(`Report ${args[0]} failed (${result.status})`);
}

if (import.meta.main) {
  const results = plan.shards.flatMap((shard) => {
    try {
      return [
        JSON.parse(
          readFileSync(
            join(DIRECTORY, 'results', `shard-${shard.index}.json`),
            'utf8'
          )
        ) as {
          actualMs: number;
          verdict: number;
          tasks: unknown[];
          hits: number;
        },
      ];
    } catch {
      return [];
    }
  });
  const skew = imbalance(results.map((result) => result.actualMs));
  console.log(
    `actual shard imbalance ${(skew * 100).toFixed(1)}%; ${results.reduce((sum, result) => sum + result.hits, 0)}/${plan.tasks.length} hits`
  );
  if (skew > 0.1)
    console.warn(
      '::warning::Actual shard imbalance exceeds 10%; harvest these timings before the next run'
    );
  command(['prepare']);
  const missing = JSON.parse(
    readFileSync(`${reportPlan}.missing.json`, 'utf8')
  ) as string[];
  let failed =
    results.length !== plan.shards.length ||
    results.some((result) => result.verdict !== 0);
  try {
    await restoreReportOutputs(missing, plan, ROOT, env);
    command(['batch']);
  } catch (error) {
    failed = true;
    console.error(error);
  }
  command(['close', ...(failed ? ['failed'] : [])]);
}
