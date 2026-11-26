// @io-wall-ok — reads the pull request's diff from git and the checkout's package directories.
/**
 * What a pull request verifies (`VERIFY_CI_STAGE=pr`): the gate's
 * pull-request tasks (`PR_TASKS` in `ci-stage.ts`) that its own diff reaches,
 * and only those that fit inside its job.
 *
 * Reach is turbo's hash, limited to the diff. A task is reached when a path
 * the pull request changes is one of its inputs (`turbo run --dry=json` lists
 * every task's inputs), when its package lost a file or changed its
 * `turbo.json`, or when a task it depends on is reached (`^src` carries a
 * package's source change to every dependent). What main changed since the
 * branch point is Release's to verify, not this pull request's. The secret
 * scan reads the commit range itself, so every pull request runs it.
 *
 * The diff reaches every task when it changes what no task's inputs bound: a
 * root-level file other than Markdown (the workspace manifest, the lockfile,
 * turbo, Bun and TypeScript configuration, which tools in every package read),
 * a global turbo input, or a path deleted outside every package, which no
 * remaining task lists.
 *
 * A reached task still waits for Release when it cannot run straight from
 * source inside the job: a prerequisite does work (a build, a Storybook
 * bundle, generated assets), it drives a browser or the model-checking
 * solver, or it measured longer than {@link PR_TASK_SECONDS}.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { capture } from '@pkgs/os-server-ts/command';
import { isBlockingCiTask, PR_TASKS } from './ci-stage';
import type { DryRunTask, TurboDryRun } from './turbo-dry-run-projection';
import { browserTask, solverTask } from './verify-browser-tasks';
import type { TaskCosts } from './verify-task-costs';

/**
 * The longest a task may have measured (`verify-task-costs.json`) and still
 * run on a pull request. The job has three minutes and spends about seventy
 * seconds before the gate starts (Verify PR run 45815900573).
 */
export const PR_TASK_SECONDS = 60;

/** A path the pull request adds, modifies or deletes, from the repository root. */
export type Change = { readonly path: string; readonly deleted: boolean };

export type PrSelection = {
  /** The reached tasks the pull request runs, in dry-run order. */
  readonly tasks: readonly DryRunTask[];
  /** Reached tasks left to Release, each with the reason. */
  readonly deferred: readonly (readonly [taskId: string, reason: string])[];
  /** Why the diff reaches every task, or `null` when task inputs bound it. */
  readonly everything: string | null;
};

const NO_OP = '<NONEXISTENT>';
/** Hashes `VERIFY_SECRETS_RANGE`, the commits the pull request adds. */
const RANGE_TASK = '@libs/tools-harness-ts#verify:secrets';
const WORKSPACE_TIERS = ['apps', 'libs', 'pkgs'];

/**
 * `dryRun` is projected with the changed paths (`readsChange`); `packages`
 * holds the checkout's package directories (`packageDirectories`).
 */
export function selectPrTasks(
  dryRun: TurboDryRun,
  changes: readonly Change[],
  context: { readonly packages: ReadonlySet<string>; readonly costs: TaskCosts }
): PrSelection {
  const byId = new Map(dryRun.tasks.map((task) => [task.taskId, task]));
  const everything = unboundedChange(dryRun, changes, context.packages);
  const reached = reachedBy(byId, changes);
  const tasks: DryRunTask[] = [];
  const deferred: [string, string][] = [];
  for (const task of dryRun.tasks) {
    if (task.command === NO_OP || !isBlockingCiTask(task.taskId, PR_TASKS))
      continue;
    if (everything === null && !reached(task.taskId)) continue;
    const reason = waitsForRelease(task, byId, context.costs);
    if (reason === null) tasks.push(task);
    else deferred.push([task.taskId, reason]);
  }
  return { tasks, deferred, everything };
}

export function describePrSelection(
  selection: PrSelection,
  changes: readonly Change[]
): readonly string[] {
  const reach =
    selection.everything === null
      ? `${String(changes.length)} changed paths reach`
      : `${selection.everything}, so the diff reaches`;
  return [
    `turbo-ci-run: pull request: ${reach} ${String(selection.tasks.length)} gate tasks it verifies`,
    ...selection.deferred.map(
      ([taskId, reason]) => `  release  ${taskId} (${reason})`
    ),
  ];
}

function reachedBy(
  byId: ReadonlyMap<string, DryRunTask>,
  changes: readonly Change[]
): (taskId: string) => boolean {
  const memo = new Map<string, boolean>();
  const reached = (taskId: string): boolean => {
    const known = memo.get(taskId);
    if (known !== undefined) return known;
    memo.set(taskId, false);
    const task = byId.get(taskId);
    const result =
      task !== undefined &&
      (task.readsChange === true ||
        taskId === RANGE_TASK ||
        ownsChange(task, changes) ||
        dependencies(task).some(reached));
    memo.set(taskId, result);
    return result;
  };
  return reached;
}

/** A deleted file is in no input listing, and `turbo.json` defines the tasks. */
function ownsChange(task: DryRunTask, changes: readonly Change[]): boolean {
  if (task.directory === '') return false;
  const definitions = `${task.directory}/turbo.json`;
  return changes.some(
    (change) =>
      change.path === definitions ||
      (change.deleted && change.path.startsWith(`${task.directory}/`))
  );
}

function unboundedChange(
  dryRun: TurboDryRun,
  changes: readonly Change[],
  packages: ReadonlySet<string>
): string | null {
  const global = new Set(Object.keys(dryRun.globalCacheInputs?.files ?? {}));
  for (const { path, deleted } of changes) {
    if (global.has(path)) return `${path} is a global turbo input`;
    if (!(path.includes('/') || path.endsWith('.md')))
      return `${path} configures every package`;
    if (deleted && !packages.has(path.split('/').slice(0, 2).join('/')))
      return `${path} was deleted outside every package`;
  }
  return null;
}

function waitsForRelease(
  task: DryRunTask,
  byId: ReadonlyMap<string, DryRunTask>,
  costs: TaskCosts
): string | null {
  if (browserTask(task.taskId)) return 'drives a browser';
  if (solverTask(task.taskId)) return 'runs the model-checking solver';
  const prerequisite = workingPrerequisite(task, byId);
  if (prerequisite !== undefined) return `needs ${prerequisite} first`;
  const seconds = costs[task.taskId] ?? 0;
  return seconds > PR_TASK_SECONDS ? `measured ${String(seconds)}s` : null;
}

function workingPrerequisite(
  task: DryRunTask,
  byId: ReadonlyMap<string, DryRunTask>
): string | undefined {
  const seen = new Set<string>();
  const stack = [...dependencies(task)];
  while (stack.length > 0) {
    const taskId = stack.pop() as string;
    if (seen.has(taskId)) continue;
    seen.add(taskId);
    const dependency = byId.get(taskId);
    if (dependency === undefined) continue;
    if (dependency.command !== NO_OP) return taskId;
    stack.push(...dependencies(dependency));
  }
  return undefined;
}

function dependencies(task: DryRunTask): readonly string[] {
  return Array.isArray(task.dependencies)
    ? task.dependencies.filter((dep): dep is string => typeof dep === 'string')
    : [];
}

/** The paths a `<base>..<head>` commit range changes. A failed diff throws. */
export function prChanges(range: string, cwd: string): readonly Change[] {
  const [base = '', head = ''] = range.split('..');
  const diff = capture(
    'git',
    ['diff', '--name-status', '--no-renames', '-z', base, head],
    { cwd }
  );
  if (diff.status !== 0)
    throw new Error(`pr-selection: git diff ${range}: ${diff.stderr.trim()}`);
  const fields = diff.stdout.split('\0');
  const changes: Change[] = [];
  for (let index = 0; index + 1 < fields.length; index += 2)
    changes.push({
      path: fields[index + 1] as string,
      deleted: fields[index] === 'D',
    });
  return changes;
}

/** `apps/<name>`, `libs/<name>` and `pkgs/<name>` directories with a manifest. */
export function packageDirectories(root: string): ReadonlySet<string> {
  const directories = new Set<string>();
  for (const tier of WORKSPACE_TIERS) {
    if (!existsSync(join(root, tier))) continue;
    for (const name of readdirSync(join(root, tier)))
      if (existsSync(join(root, tier, name, 'package.json')))
        directories.add(`${tier}/${name}`);
  }
  return directories;
}

/** Pack cold work after cache lookup. Reserve 40 seconds per available slot
 * for execution within the 120-second target and send overflow to Release.
 * Workflow syntax and the immutable credential scan always run when selected. */
export function admitPrMisses(
  misses: readonly { readonly taskId: string }[],
  changes: readonly Change[],
  costs: TaskCosts,
  concurrency: number
): ReadonlySet<string> {
  const lanes: number[] = Array.from(
    { length: Math.max(1, Math.min(4, concurrency)) },
    () => 40
  );
  const selected = new Set<string>();
  const priority = (id: string) => {
    if (id === RANGE_TASK || id.endsWith('#verify:actionlint')) return 0;
    const directory = id.split('#')[0]?.replace(/^@/, '') ?? '';
    return changes.some(({ path }) => path.startsWith(`${directory}/`)) ? 1 : 2;
  };
  const ordered = misses
    .map(({ taskId }) => taskId)
    .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
  for (const id of ordered) {
    const remaining = Math.max(...lanes);
    // Cold runs on the hosted runner took much longer than warm history.
    // Charge a half-lane minimum even when a past unit suite took a second.
    const seconds = Math.max(priority(id) === 0 ? 1 : 25, costs[id] ?? 25);
    if (priority(id) > 0 && seconds > remaining) continue;
    lanes[lanes.indexOf(remaining)] = remaining - seconds;
    selected.add(id);
  }
  return selected;
}
