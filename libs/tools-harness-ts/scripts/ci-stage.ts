/**
 * Which gate tasks each CI stage runs: every stage runs the whole gate
 * catalog (`MAIN_VERIFY_TASKS`). Stages differ in depth (`verify-profile.ts`)
 * and in the nightly-only groups outside the gate (random, browser, visual,
 * coverage, performance), never in which gate tasks they hold a change to.
 *
 * Selection costs nothing: the plan asks the remote cache about every task,
 * so a pull request executes only the tasks whose inputs it changed and
 * replays every other verdict. A narrower PR/Release selection let changes
 * that broke a gate task merge green and turn every later nightly red
 * (known bug `pr-gate-narrower-than-nightly`): `verify:brand-policy`,
 * `@apps/server-ts#test`, `ci:specs`, spec parts and contract models among
 * them.
 */
const STAGES = new Set(['pr', 'release', 'nightly']);

/** Unset retains full local verification; unknown stages fail closed. */
export function ciStageTasks(
  catalog: readonly string[],
  stage: string | undefined
): readonly string[] {
  if (stage !== undefined && stage !== '' && !STAGES.has(stage))
    throw new Error(`Unknown CI stage: ${stage}`);
  return catalog;
}

/**
 * Whether an expanded task id (`@pkg#task`) is a gate task every stage
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
