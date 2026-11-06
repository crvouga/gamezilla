export type RequiredPrCheck = {
  readonly context: string;
  readonly integration_id: number;
};

export type PrCheck = {
  readonly name: string;
  readonly appId: number;
  readonly status: string;
  readonly conclusion: string | null;
};

const ACTIONS = 15368;
const SHARD = /^verify:shards(?: \(\d+\))?$/;

/** Manual rehearsal, release and nightly jobs do not belong to the PR workflow. */
export function isPullRequestCheck(appId: number, event: string): boolean {
  return (
    appId !== ACTIONS ||
    !['workflow_dispatch', 'push', 'schedule'].includes(event)
  );
}

/** The current aggregate cannot await itself; it already checks every planned task. */
function aggregate(check: Pick<PrCheck, 'name' | 'appId'>): boolean {
  return check.appId === ACTIONS && check.name === 'verify:end';
}

/** No discovered PR check can silently become advisory, including future integrations. */
export function requiredPrCheckFailures(
  required: readonly RequiredPrCheck[],
  checks: readonly PrCheck[],
  emptyShardPlan: boolean
): readonly string[] {
  const failures: string[] = [];
  for (const policy of required) {
    if (aggregate({ name: policy.context, appId: policy.integration_id }))
      continue;
    if (
      !checks.some(
        (check) =>
          check.name === policy.context && check.appId === policy.integration_id
      )
    )
      failures.push(
        `Missing required check: ${policy.context} (app ${policy.integration_id})`
      );
  }
  for (const check of checks) {
    if (aggregate(check)) continue;
    const shard = check.appId === ACTIONS && SHARD.test(check.name);
    const declared = required.some(
      (policy) =>
        policy.context === check.name && policy.integration_id === check.appId
    );
    // GitGuardian was explicitly retired; its installed app can still post results.
    if (!declared && check.appId === 46505) continue;
    if (!shard && !declared) {
      failures.push(
        `Optional or untrusted check: ${check.name} (app ${check.appId}); declare it in the repository required-checks registry`
      );
      continue;
    }
    const cachedShard =
      emptyShardPlan &&
      check.name === 'verify:shards' &&
      check.conclusion === 'skipped';
    if (
      check.status !== 'completed' ||
      (check.conclusion !== 'success' && !cachedShard)
    )
      failures.push(
        `Required check did not pass: ${check.name} (${check.conclusion ?? check.status})`
      );
  }
  return [...new Set(failures)];
}
