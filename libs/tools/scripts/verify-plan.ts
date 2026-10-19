// @io-wall-ok — CI planning entry; artifacts contain identities, never environment values.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureAudit } from './audit-snapshot';
import { SECRETS_RANGE_ENV, secretsScanRange } from './secrets-scan-range';
import {
  flattenVerifyAggregators,
  turboChildEnv,
  writePlatformCacheKey,
} from './turbo-ci-run';
import type { RunPlan } from './turbo-preflight';
import {
  planFromDryRun,
  resolveRemoteHits,
  wallRemoteHas,
} from './turbo-preflight';
import { cacheDiagnostics } from './verify-cache-diagnostics';
import { startedFirst, writeSchedule } from './verify-plan-schedule';
import { profileManifest } from './verify-profile';
import type { VerifyTask } from './verify-shards';
import { balanceShards, planWarnings } from './verify-shards';
import { readScheduleCosts } from './verify-task-costs';
import { estimateScheduledTask, shardSummary } from './verify-task-estimates';

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/verify-ci');
/**
 * Estimated seconds of uncached work one shard is started for, per Turbo
 * slot. A runner spends about a minute on checkout and install before its
 * first task (Verify run 38128423200: 7 s and 40 s medians, plus the plan
 * restore), so three minutes of useful work amortizes its startup. Heavy tasks and
 * solvers retain dedicated runners; this only batches lightweight misses.
 */
const SHARD_TARGET_SECONDS = 180;

function shardTargetSeconds(env: NodeJS.ProcessEnv): number {
  const slots = Number(env['VERIFY_CONCURRENCY'] ?? '1');
  return (
    SHARD_TARGET_SECONDS *
    (Number.isSafeInteger(slots) && slots > 0 ? slots : 1)
  );
}

export async function createVerifyPlan(): Promise<void> {
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
      ...flattenVerifyAggregators(['verify']),
      '--filter=./apps/*',
      '--filter=./libs/*',
      '--filter=./pkgs/*',
      '--framework-inference=false',
      '--cache=local:rw',
      '--dry=json',
    ],
    { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }
  );
  const discoveryMs = Number(process.hrtime.bigint() - discoveryStarted) / 1e6;
  const lookupStarted = process.hrtime.bigint();
  const local = planFromDryRun(json);
  const costs = readScheduleCosts();
  const { resolved, remoteResponses, responsesByHash } = await resolveCache(
    local,
    env
  );
  const lookupMs = Number(process.hrtime.bigint() - lookupStarted) / 1e6;
  const raw = JSON.parse(json) as {
    tasks: { taskId: string; command: string; directory: string }[];
    globalCacheInputs?: GlobalCacheInputs;
  };
  const repoWide = repoWideInputs(raw.globalCacheInputs);
  const definitions = new Map(raw.tasks.map((task) => [task.taskId, task]));
  const tasks: VerifyTask[] = resolved.tasks.map((task) => ({
    ...task,
    command: definitions.get(task.taskId)!.command,
    directory: definitions.get(task.taskId)!.directory,
    ...estimateScheduledTask(task.taskId, costs),
  }));
  if (env['VERIFY_CACHE_MODE'] === 'cold')
    for (const task of tasks) Object.assign(task, { hit: false, source: null });
  const plan = startedFirst(
    balanceShards(
      tasks,
      Number(env['VERIFY_SHARDS'] ?? '16'),
      shardTargetSeconds(env)
    )
  );
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
      repoWide,
      cacheMisses: cacheDiagnostics(tasks, responsesByHash),
    })
  );
  printPlan(plan, discoveryMs, lookupMs);
  // One of these differing from the previous run's line is a miss of every
  // task at once, whatever the pull request changed.
  console.log(`repo-wide hash inputs: ${JSON.stringify(repoWide)}`);
  schedulePlan(plan);
  for (const miss of cacheDiagnostics(tasks, responsesByHash).slice(0, 5))
    console.log(`cache miss ${miss.taskId} ${miss.hash}: ${miss.reason}`);
  writeContext(env);
}

/** The scan range and platform key every shard must run under. */
function writeContext(env: NodeJS.ProcessEnv): void {
  // The depth every shard of this run shares, and how to run it again.
  const manifest = profileManifest(env);
  writeFileSync(join(DIRECTORY, 'profile.json'), JSON.stringify(manifest));
  console.log(`profile: ${JSON.stringify(manifest)}`);
  writeFileSync(
    join(DIRECTORY, 'context.json'),
    JSON.stringify({
      secretsRange: env[SECRETS_RANGE_ENV],
      platformKey: readFileSync(join(ROOT, 'turbo-platform-key.json'), 'utf8'),
    })
  );
}

if (import.meta.main) await createVerifyPlan();

async function resolveCache(local: RunPlan, env: NodeJS.ProcessEnv) {
  const remoteResponses: Record<number, number> = {};
  const responsesByHash: Record<string, number> = {};
  const remoteHas = wallRemoteHas(env, (status, hash) => {
    responsesByHash[hash] = status;
    remoteResponses[status] = (remoteResponses[status] ?? 0) + 1;
  });
  const resolved =
    env['TURBO_TOKEN'] && env['VERIFY_CACHE_MODE'] !== 'cold'
      ? await resolveRemoteHits(local, remoteHas, 256)
      : local;
  if (remoteResponses[401] || remoteResponses[403])
    throw new Error(
      'Remote cache authentication rejected; verification TURBO_TOKEN and scope'
    );
  if (env['TURBO_TOKEN'])
    console.log(
      `cache: ${new URL(env['TURBO_API']!).origin}; scope ${env['TURBO_TEAM']}; responses ${JSON.stringify(remoteResponses)}`
    );
  return { resolved, remoteResponses, responsesByHash };
}

type GlobalCacheInputs = {
  readonly files?: Readonly<Record<string, string>>;
  readonly hashOfExternalDependencies?: string;
  readonly hashOfInternalDependencies?: string;
};

/**
 * What turbo hashes into every task: the global dependency files, the root
 * manifest's external dependencies, and the workspace packages the root
 * manifest depends on (none, by `verify-cache-keys.test.ts`).
 */
export function repoWideInputs(global: GlobalCacheInputs | undefined) {
  return {
    files: Object.fromEntries(
      Object.entries(global?.files ?? {})
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([path, hash]) => [path, hash.slice(0, 12)])
    ),
    rootExternalDependencies: global?.hashOfExternalDependencies ?? '',
    rootWorkspaceDependencies: global?.hashOfInternalDependencies ?? '',
  };
}

/** Record the cached shards and hand the workflow the matrix of the rest. */
function schedulePlan(plan: ReturnType<typeof balanceShards>): void {
  const schedule = writeSchedule(plan);
  console.log(
    `schedule: ${schedule.shards.length} of ${plan.shards.filter((shard) => shard.stage === 'verifications').length} shards have uncached work; consumers ${schedule.consumers ? 'scheduled' : 'cached'}; ${schedule.cached.length} shards recorded from the cache`
  );
}

function printPlan(
  plan: ReturnType<typeof balanceShards>,
  discoveryMs: number,
  lookupMs: number
): void {
  // Shards the plan left empty never start; listing them is noise.
  for (const shard of plan.shards)
    if (shard.tasks.length > 0 || shard.stage !== 'verifications')
      console.log(shardSummary(shard));
  for (const warning of planWarnings(plan))
    console.warn(`::warning::${warning}`);
  console.log(
    `plan: ${plan.tasks.length} exact task identities; discovery ${discoveryMs.toFixed(0)}ms; cache lookup ${lookupMs.toFixed(0)}ms`
  );
}
