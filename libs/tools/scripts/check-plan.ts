// @io-wall-ok — CI planning entry; artifacts contain identities, never environment values.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { balanceShards, imbalance, type CheckTask } from './check-shards';
import { readTaskCosts } from './check-task-costs';
import { flattenCheckAggregators, turboChildEnv, writePlatformCacheKey } from './turbo-ci-run';
import { planFromDryRun, resolveRemoteHits, wallRemoteHas } from './turbo-preflight';
import { secretsScanRange, SECRETS_RANGE_ENV } from './secrets-scan-range';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/check-ci');

export async function createCheckPlan(): Promise<void> {
  const started = process.hrtime.bigint();
  const env = turboChildEnv();
  if (env['CI'] === 'true' && !env['TURBO_TOKEN']) throw new Error('CI requires TURBO_TOKEN');
  env[SECRETS_RANGE_ENV] = secretsScanRange(env);
  writePlatformCacheKey();
  const json = execFileSync('turbo', [
    'run', ...flattenCheckAggregators(['check']),
    '--filter=./apps/*', '--filter=./libs/*', '--filter=./pkgs/*', '--filter=//',
    '--framework-inference=false', '--cache=local:rw', '--dry=json',
  ], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  const discoveryMs = Number(process.hrtime.bigint() - started) / 1e6;
  const lookupStarted = process.hrtime.bigint();
  const local = planFromDryRun(json);
  const resolved = env['TURBO_TOKEN']
    ? await resolveRemoteHits(local, wallRemoteHas(env), 64) : local;
  const lookupMs = Number(process.hrtime.bigint() - lookupStarted) / 1e6;
  const raw = JSON.parse(json) as { tasks: { taskId: string; command: string; directory: string }[] };
  const definitions = new Map(raw.tasks.map((task) => [task.taskId, task]));
  const costs = readTaskCosts();
  const tasks: CheckTask[] = resolved.tasks.map((task) => ({
    ...task, command: definitions.get(task.taskId)!.command,
    directory: definitions.get(task.taskId)!.directory,
    seconds: costs[task.taskId] ?? 5,
  }));
  const plan = balanceShards(tasks, Number(env['CHECK_SHARDS'] ?? '16'));
  mkdirSync(DIRECTORY, { recursive: true });
  writeFileSync(join(DIRECTORY, 'plan.json'), JSON.stringify(plan));
  writeFileSync(join(DIRECTORY, 'planning.json'), JSON.stringify({
    discoveryMs, lookupMs, totalMs: Number(process.hrtime.bigint() - started) / 1e6,
    tasks: tasks.length, hits: tasks.filter((task) => task.hit).length,
  }));
  for (const shard of plan.shards)
    console.log(`shard ${shard.index}: ${shard.tasks.length} tasks, estimated ${shard.seconds.toFixed(1)} task-seconds`);
  const skew = imbalance(plan.shards.map((shard) => shard.seconds));
  if (skew > 0.1) console.warn(`::warning::Estimated shard imbalance ${(skew * 100).toFixed(1)}% exceeds 10%`);
  console.log(`plan: ${tasks.length} exact task identities; discovery ${discoveryMs.toFixed(0)}ms; cache lookup ${lookupMs.toFixed(0)}ms`);
  const output = env['GITHUB_OUTPUT'];
  if (output) appendFileSync(output, `matrix=${JSON.stringify({ shard: plan.shards.map((shard) => shard.index) })}\n`);
  // The historical scan range is computed once and shared with every shard.
  writeFileSync(join(DIRECTORY, 'context.json'), JSON.stringify({ secretsRange: env[SECRETS_RANGE_ENV] }));
}

if (import.meta.main) await createCheckPlan();
