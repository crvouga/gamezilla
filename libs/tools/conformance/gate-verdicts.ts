// @io-wall-ok — asks turbo (a dry run, as `bun verify` plans itself) whether each release gate passed for the current inputs.
/**
 * Machine evidence for the release gates: turbo caches a task only when it
 * succeeded, so a cache HIT for a task's current hash is that task's green
 * verdict for exactly these inputs (`turbo-preflight.ts`). The plan is the
 * one `bun verify` makes — the same leaf tasks, filters and env — so the
 * hashes are the ones the gate itself records. A MISS is "not run for these
 * inputs", which is a failure like any other missing evidence.
 */

import {
  SECRETS_RANGE_ENV,
  secretsScanRange,
} from '../scripts/secrets-scan-range';
import { REPO_ROOT } from '../scripts/spec-packages';
import {
  flattenVerifyAggregators,
  hasRemoteCreds,
  resolveCacheFlag,
  turboChildEnv,
} from '../scripts/turbo-ci-run';
import type { RunPlan } from '../scripts/turbo-preflight';
import {
  dryRunPlan,
  localCacheFlag,
  REMOTE_LOOKUP_CONCURRENCY,
  resolveRemoteHits,
  wallRemoteHas,
} from '../scripts/turbo-preflight';
import type { TaskVerdict } from './evaluate';

/** The concrete task ids a gate task names: itself, or every package's. */
function idsFor(plan: RunPlan, task: string): readonly string[] {
  const ids = plan.tasks.map((planned) => planned.taskId);
  if (task.includes('#')) return ids.filter((id) => id === task);
  return ids.filter((id) => id.endsWith(`#${task}`) && !id.startsWith('//#'));
}

/** Each gate task's verdict from a plan of the verification graph. */
export function verdictsFromPlan(
  plan: RunPlan,
  tasks: readonly string[]
): ReadonlyMap<string, TaskVerdict> {
  const hits = new Map(
    plan.tasks.map((planned) => [planned.taskId, planned.hit])
  );
  const out = new Map<string, TaskVerdict>();
  for (const task of tasks) {
    const ids = idsFor(plan, task);
    const missed = ids.filter((id) => hits.get(id) !== true);
    if (ids.length === 0) {
      out.set(task, {
        status: 'fail',
        detail: 'not run — bun verify does not plan it',
      });
    } else if (missed.length > 0) {
      out.set(task, {
        status: 'fail',
        detail: `not run for these inputs — ${String(missed.length)} of ${String(ids.length)} not passed in the build cache (${missed.slice(0, 3).join(', ')}${missed.length > 3 ? ', …' : ''})`,
      });
    } else {
      out.set(task, {
        status: 'pass',
        detail: `passed for these inputs (${String(ids.length)} task${ids.length === 1 ? '' : 's'})`,
      });
    }
  }
  return out;
}

/** Filters `turbo-ci-run` adds so package tasks never schedule the root's own scripts. */
function rootExcludeFilters(taskArgs: readonly string[]): readonly string[] {
  const bare = taskArgs.some(
    (a) => !a.startsWith('//') && !a.startsWith('--') && !a.includes('#')
  );
  if (!bare) return [];
  const filters = [
    '--filter=./apps/*',
    '--filter=./libs/*',
    '--filter=./pkgs/*',
  ];
  if (taskArgs.some((a) => a.startsWith('//'))) filters.push('--filter=//');
  return filters;
}

/** Plan `bun verify` as `turbo-ci-run` does and read each gate's verdict. */
export async function gateVerdicts(
  tasks: readonly string[]
): Promise<ReadonlyMap<string, TaskVerdict>> {
  const env = turboChildEnv(process.env);
  env[SECRETS_RANGE_ENV] = secretsScanRange(env);
  const remote = hasRemoteCreds(env);
  const cache = resolveCacheFlag(env, remote);
  const taskArgs = flattenVerifyAggregators(['verify']);
  let plan: RunPlan;
  try {
    plan = dryRunPlan(
      [
        'run',
        ...taskArgs,
        ...rootExcludeFilters(taskArgs),
        `--cache=${localCacheFlag(cache) ?? cache}`,
        '--framework-inference=false',
      ],
      REPO_ROOT,
      env
    );
    if (remote && plan.toExecute.length > 0) {
      plan = await resolveRemoteHits(
        plan,
        wallRemoteHas(env),
        REMOTE_LOOKUP_CONCURRENCY
      );
    }
  } catch (cause) {
    const detail = `no verdict — planning bun verify failed: ${cause instanceof Error ? cause.message.split('\n')[0] : String(cause)}`;
    return new Map(tasks.map((task) => [task, { status: 'fail', detail }]));
  }
  return verdictsFromPlan(plan, tasks);
}
