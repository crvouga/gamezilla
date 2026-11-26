const STAGES = new Set(['pr', 'release', 'nightly']);

/**
 * The pull-request gate, and why each task cannot wait for Release:
 * - `tc`, `lint`: main must compile and keep its boundaries, or every Release
 *   failure after it is noise.
 * - `verify:secrets`: a credential that reaches main has leaked.
 * - `verify:actionlint`: a workflow that does not parse cannot run Release,
 *   so nothing would report it.
 */
export const PR_TASKS: readonly string[] = [
  'tc',
  'lint',
  '@libs/tools-harness-ts#verify:secrets',
  '@libs/tools-harness-ts#verify:actionlint',
];

/** Unset retains full local verification; unknown stages fail closed. */
export function ciStageTasks(
  catalog: readonly string[],
  stage: string | undefined
): readonly string[] {
  if (stage !== undefined && stage !== '' && !STAGES.has(stage))
    throw new Error(`Unknown CI stage: ${stage}`);
  if (stage === 'release')
    return catalog.filter(
      (task) => !task.startsWith('@pkgs/ui-root-harness-ts#ci:storybook:')
    );
  return stage === 'pr'
    ? catalog.filter((task) => PR_TASKS.includes(task))
    : catalog;
}

/**
 * Whether an expanded task id (`@pkg#task`) is a gate task Release
 * blocks on, for workload reporting. Anything else (fresh-seed random
 * walks, benchmarks, visual corpora) is one of nightly's deeper groups.
 */
export function isBlockingCiTask(
  id: string,
  catalog: readonly string[]
): boolean {
  return (
    catalog.includes(id) || catalog.includes(id.slice(id.indexOf('#') + 1))
  );
}
