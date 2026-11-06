/** PR and Release enforce the same safety and production-build journeys. */
const STATIC = new Set([
  'tc',
  'lint',
  '@libs/tools-harness-ts#ci:syncpack',
  '@libs/tools-harness-ts#ci:audit',
  '@libs/tools-harness-ts#verify:root-lint',
  '@libs/tools-harness-ts#verify:actionlint',
  '@libs/tools-harness-ts#verify:workflow-security',
  '@libs/tools-harness-ts#verify:secrets',
]);
const DEPLOYMENT = new Set([
  '@apps/auth-relay-ts#verify:worker-bundle',
  '@apps/product-ts#verify:worker-bundle',
  '@apps/product-ts#verify:rendered-worker',
  '@apps/product-ts#verify:offline-shell',
  '@libs/runtime-server-ts#verify:schema-evolution',
  '@apps/synthetic-population-worker-ts#verify:synthetic-population-foundation',
  '@libs/infra-server-ts#verify:repository-policy',
]);

const SECURITY_TESTS = [
  '@libs/permissions-harness-ts#test',
  '@libs/permissions-shared-ts#test',
  '@pkgs/permissions-shared-ts#test',
  '@pkgs/db-migrate-shared-ts#test',
  '@pkgs/db-schema-root-shared-ts#test',
  '@pkgs/auth-inhouse-harness-ts#test',
  '@pkgs/auth-root-harness-ts#test',
];

/** Unset retains full local verification; unknown stages fail closed. */
export function ciStageTasks(
  catalog: readonly string[],
  stage: string | undefined
): readonly string[] {
  if (stage === undefined || stage === '' || stage === 'nightly')
    return catalog;
  if (stage !== 'pr' && stage !== 'release')
    throw new Error(`Unknown CI stage: ${stage}`);
  // Recheck the selected commit, including merge changes, with cached results
  // only for identical inputs. PR catches critical browser failures before merge.
  return [
    ...catalog.filter(
      (task) =>
        STATIC.has(task) || DEPLOYMENT.has(task) || isReleaseJourney(task)
    ),
    ...SECURITY_TESTS,
  ];
}

/** Match an expanded package task id for workload reporting. */
export function isBlockingCiTask(id: string): boolean {
  return (
    STATIC.has(id) ||
    DEPLOYMENT.has(id) ||
    SECURITY_TESTS.includes(id) ||
    isReleaseJourney(id) ||
    STATIC.has(id.slice(id.indexOf('#') + 1))
  );
}

function isReleaseJourney(id: string): boolean {
  return id.startsWith('@apps/product-ts#test:release-journeys:');
}
