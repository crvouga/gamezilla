const STAGES = new Set(['pr', 'release', 'nightly']);

/**
 * The pull-request gate, and why each task cannot wait for Release. A pull
 * request runs them only where its own diff reaches, and only those that fit
 * inside its job (`pr-selection.ts`).
 * - `tc`, `lint`: main must compile and keep its boundaries, or every Release
 *   failure after it is noise.
 * - `test` and its partitions: a broken unit test of the changed code blocks
 *   every release behind it, and finding it takes seconds.
 * - `verify:secrets`: a credential that reaches main has leaked.
 * - `verify:actionlint`: a workflow that does not parse cannot run Release,
 *   so nothing would report it.
 */
export const PR_TASKS: readonly string[] = [
  'tc',
  'lint',
  'test',
  'test:unit:1',
  'test:unit:2',
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

/** Blocking deployment checks. Manual branch diagnostics keep their full catalog. */
export function deploymentTasks(catalog: readonly string[]): readonly string[] {
  const tasks = catalog.filter(
    (task) =>
      task.startsWith('@apps/product-ts#verify:') ||
      [
        '@apps/admin-api-ts#verify:worker-bundle',
        '@apps/auth-relay-ts#verify:worker-bundle',
        '@libs/infra-server-ts#verify:repository-policy',
        '@libs/runtime-server-ts#verify:schema-evolution',
        '@libs/tools-harness-ts#ci:audit',
        '@libs/tools-harness-ts#verify:workflow-security',
        '@libs/tools-harness-ts#verify:secrets',
        '@libs/tools-harness-ts#verify:actionlint',
      ].includes(task)
  );
  return [
    ...tasks,
    '@apps/product-ts#test:release-journeys:critical',
    '@apps/product-api-ts#test',
    '@libs/billing-harness-ts#test',
    '@libs/permissions-harness-ts#test',
    '@libs/infra-server-ts#test',
    '@pkgs/db-migrate-shared-ts#test',
    '@pkgs/auth-root-harness-ts#test',
  ];
}
