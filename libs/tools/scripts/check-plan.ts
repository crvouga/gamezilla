// @io-wall-ok — CI planning entry; artifacts contain identities, never environment values.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureAudit } from './audit-snapshot';
import { cacheDiagnostics } from './check-cache-diagnostics';
import type { CheckTask } from './check-shards';
import { balanceShards, planWarnings } from './check-shards';
import { readTaskCosts } from './check-task-costs';
import { estimateTask, shardSummary } from './check-task-estimates';
import { SECRETS_RANGE_ENV, secretsScanRange } from './secrets-scan-range';
import {
  flattenCheckAggregators,
  turboChildEnv,
  writePlatformCacheKey,
} from './turbo-ci-run';
import type { RunPlan } from './turbo-preflight';
import {
  planFromDryRun,
  resolveRemoteHits,
  wallRemoteHas,
} from './turbo-preflight';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/check-ci');

export async function createCheckPlan(): Promise<void> {
  const started = process.hrtime.bigint();
  const auditMs = captureAudit(ROOT);
  const discoveryStarted = process.hrtime.bigint();
  const env = turboChildEnv();
  if (env['CI'] === 'true' && !env['TURBO_TOKEN'])
    throw new Error('CI requires TURBO_TOKEN');
  env[SECRETS_RANGE_ENV] = secretsScanRange(env);
  writePlatformCacheKey();
  const json = execFileSync(
    'turbo',
    [
      'run',
      ...flattenCheckAggregators(['check']),
      '--filter=./apps/*',
      '--filter=./libs/*',
      '--filter=./pkgs/*',
      '--filter=//',
      '--framework-inference=false',
      '--cache=local:rw',
      '--dry=json',
    ],
    { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }
  );
  const discoveryMs = Number(process.hrtime.bigint() - discoveryStarted) / 1e6;
  const lookupStarted = process.hrtime.bigint();
  const local = planFromDryRun(json);
  const costs = readTaskCosts();
  const { resolved, remoteResponses, responsesByHash } = await resolveCache(
    local,
    env
  );
  const lookupMs = Number(process.hrtime.bigint() - lookupStarted) / 1e6;
  const raw = JSON.parse(json) as {
    tasks: { taskId: string; command: string; directory: string }[];
  };
  const definitions = new Map(raw.tasks.map((task) => [task.taskId, task]));
  const tasks: CheckTask[] = resolved.tasks.map((task) => ({
    ...task,
    command: definitions.get(task.taskId)!.command,
    directory: definitions.get(task.taskId)!.directory,
    ...estimateTask(task.taskId, costs),
  }));
  if (env['CHECK_CACHE_MODE'] === 'cold')
    for (const task of tasks) Object.assign(task, { hit: false, source: null });
  const plan = balanceShards(tasks, Number(env['CHECK_SHARDS'] ?? '16'));
  mkdirSync(DIRECTORY, { recursive: true });
  writeFileSync(join(DIRECTORY, 'plan.json'), JSON.stringify(plan));
  writeFileSync(
    join(DIRECTORY, 'planning.json'),
    JSON.stringify({
      discoveryMs,
      auditMs,
      lookupMs,
      totalMs: Number(process.hrtime.bigint() - started) / 1e6,
      tasks: tasks.length,
      hits: tasks.filter((task) => task.hit).length,
      remoteResponses,
      cacheMisses: cacheDiagnostics(tasks, responsesByHash),
    })
  );
  printPlan(plan, discoveryMs, lookupMs);
  for (const miss of cacheDiagnostics(tasks, responsesByHash).slice(0, 5))
    console.log(`cache miss ${miss.taskId} ${miss.hash}: ${miss.reason}`);
  // Capture the same historical scan context alongside this shard's plan.
  writeFileSync(
    join(DIRECTORY, 'context.json'),
    JSON.stringify({
      secretsRange: env[SECRETS_RANGE_ENV],
      platformKey: readFileSync(join(ROOT, 'turbo-platform-key.json'), 'utf8'),
    })
  );
}

if (import.meta.main) await createCheckPlan();

async function resolveCache(local: RunPlan, env: NodeJS.ProcessEnv) {
  const remoteResponses: Record<number, number> = {};
  const responsesByHash: Record<string, number> = {};
  const remoteHas = wallRemoteHas(env, (status, hash) => {
    responsesByHash[hash] = status;
    remoteResponses[status] = (remoteResponses[status] ?? 0) + 1;
  });
  const resolved =
    env['TURBO_TOKEN'] && env['CHECK_CACHE_MODE'] !== 'cold'
      ? await resolveRemoteHits(local, remoteHas, 256)
      : local;
  if (remoteResponses[401] || remoteResponses[403])
    throw new Error(
      'Remote cache authentication rejected; check TURBO_TOKEN and scope'
    );
  if (env['TURBO_TOKEN'])
    console.log(
      `cache: ${new URL(env['TURBO_API']!).origin}; scope ${env['TURBO_TEAM']}; responses ${JSON.stringify(remoteResponses)}`
    );
  return { resolved, remoteResponses, responsesByHash };
}

function printPlan(
  plan: ReturnType<typeof balanceShards>,
  discoveryMs: number,
  lookupMs: number
): void {
  for (const shard of plan.shards) console.log(shardSummary(shard));
  for (const warning of planWarnings(plan))
    console.warn(`::warning::${warning}`);
  console.log(
    `plan: ${plan.tasks.length} exact task identities; discovery ${discoveryMs.toFixed(0)}ms; cache lookup ${lookupMs.toFixed(0)}ms`
  );
}
