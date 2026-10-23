/**
 * Every task a turbo root task reaches, as turbo would schedule it: a
 * `pkg#task` id as named, a bare `task` for every package whose
 * `package.json` has that script (and the bare name itself), `^task` for
 * every package's `task` (an over-approximation of "my dependencies'"), and
 * each reached task's own `dependsOn` in turn. Pure over turbo.json's tasks
 * and each package's scripts.
 */

export type TurboTasks = Readonly<
  Record<string, { readonly dependsOn?: readonly string[] }>
>;

/** Package name → its script names. */
export type PackageScripts = ReadonlyMap<string, ReadonlySet<string>>;

function configOf(tasks: TurboTasks, id: string): readonly string[] {
  const own = tasks[id]?.dependsOn;
  if (own !== undefined) return own;
  const hash = id.indexOf('#');
  return hash > 0 ? (tasks[id.slice(hash + 1)]?.dependsOn ?? []) : [];
}

/** The concrete ids a dependency names, from inside `owner` (a package or `//`). */
function expand(
  dep: string,
  owner: string,
  scripts: PackageScripts
): readonly string[] {
  if (dep.includes('#')) return [dep];
  const across = dep.startsWith('^') || owner === '//';
  const name = dep.startsWith('^') ? dep.slice(1) : dep;
  if (!across) return [`${owner}#${name}`];
  const out = [name];
  for (const [pkg, names] of scripts) {
    if (names.has(name)) out.push(`${pkg}#${name}`);
  }
  return out;
}

/** Every task id `root` (a `pkg#task` or `//#task` id) reaches, itself included. */
export function reachableTasks(
  tasks: TurboTasks,
  scripts: PackageScripts,
  root: string
): ReadonlySet<string> {
  const seen = new Set<string>([root]);
  const queue: string[] = [root];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    const hash = id.indexOf('#');
    // A bare name stands for every package's task, each reached on its own.
    if (hash <= 0) continue;
    for (const dep of configOf(tasks, id)) {
      for (const next of expand(dep, id.slice(0, hash), scripts)) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** Every task the sharded Verification schedules from its package-owned task list. */
export function reachableVerifyTasks(
  tasks: TurboTasks,
  scripts: PackageScripts,
  roots: readonly string[]
): ReadonlySet<string> {
  const reached = new Set<string>();
  for (const root of roots) {
    if (root.includes('#')) {
      for (const task of reachableTasks(tasks, scripts, root))
        reached.add(task);
      continue;
    }
    reached.add(root);
    for (const [pkg, names] of scripts) {
      if (!names.has(root)) continue;
      for (const task of reachableTasks(tasks, scripts, `${pkg}#${root}`))
        reached.add(task);
    }
  }
  return reached;
}
