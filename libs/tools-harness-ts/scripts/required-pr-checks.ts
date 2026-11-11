export type RequiredPrCheck = {
  readonly context: string;
  readonly integration_id: number;
  /**
   * The check depends on a download GitHub can fail to serve (the CodeQL
   * bundle). The ruleset leaves it out; this gate enforces it, and an
   * unavailable scanner warns instead of blocking.
   */
  readonly outage_tolerant?: boolean;
  /**
   * The check reports on something beside the change's correctness (the pull
   * request's Preview deployment). The ruleset leaves it out; this gate waits
   * for it, and one that is absent or did not pass warns instead of blocking.
   */
  readonly advisory?: boolean;
};

export type PrCheck = {
  readonly sha?: string;
  readonly name: string;
  readonly appId: number;
  readonly status: string;
  readonly conclusion: string | null;
};

const ACTIONS = 15368;
const SHARD = /^verify:shards(?: \(\d+\))?$/;
/**
 * A skipped matrix job never expands its name: GitHub reports the job
 * template, with the expression unevaluated or not.
 */
const UNEXPANDED_SHARD = new Set([
  'verify:shards',
  'verify:shards (${{ strategy.job-index }})',
]);

/** Manual rehearsal, release and nightly jobs do not belong to the PR workflow. */
export function isPullRequestCheck(appId: number, event: string): boolean {
  return (
    appId !== ACTIONS ||
    !['workflow_dispatch', 'push', 'schedule'].includes(event)
  );
}

/** The current aggregate cannot await itself; it already checks every planned task. */
export function aggregate(check: Pick<PrCheck, 'name' | 'appId'>): boolean {
  return check.appId === ACTIONS && check.name === 'verify:end';
}

const SCAN_RESULTS = { name: 'CodeQL', appId: 57789 } as const;

function isScanResults(check: Pick<PrCheck, 'name' | 'appId'>): boolean {
  return check.name === SCAN_RESULTS.name && check.appId === SCAN_RESULTS.appId;
}

/** A failed or neutral result means the scanner did not run, not that it found anything. */
function scannerUnavailable(check: PrCheck): boolean {
  if (check.status !== 'completed') return false;
  return isScanResults(check)
    ? check.conclusion === 'neutral' || check.conclusion === 'skipped'
    : check.conclusion !== 'success';
}

/**
 * The scan results check is only absent for good when every analysis ended
 * and none succeeded: nothing was uploaded for it to report.
 */
function scanResultsCannotArrive(
  required: readonly RequiredPrCheck[],
  checks: readonly PrCheck[]
): boolean {
  const analyses = checks.filter(
    (check) =>
      !isScanResults(check) &&
      required.some(
        (policy) =>
          policy.outage_tolerant === true &&
          policy.context === check.name &&
          policy.integration_id === check.appId
      )
  );
  return (
    analyses.length > 0 &&
    analyses.every(
      (check) => check.status === 'completed' && check.conclusion !== 'success'
    )
  );
}

function advisory(
  required: readonly RequiredPrCheck[],
  check: Pick<PrCheck, 'name' | 'appId'>
): boolean {
  return required.some(
    (policy) =>
      policy.advisory === true &&
      policy.context === check.name &&
      policy.integration_id === check.appId
  );
}

/** Checks this gate let through without a pass: an unavailable scanner, an advisory check. */
export function unavailableScannerWarnings(
  required: readonly RequiredPrCheck[],
  checks: readonly PrCheck[]
): readonly string[] {
  const warnings: string[] = [];
  for (const check of checks)
    if (
      advisory(required, check) &&
      check.status === 'completed' &&
      check.conclusion !== 'success'
    )
      warnings.push(
        `${check.name} did not pass (${check.conclusion ?? check.status}); advisory, not blocking`
      );
  for (const policy of required) {
    if (policy.outage_tolerant !== true) continue;
    const matching = checks.filter(
      (check) =>
        check.name === policy.context && check.appId === policy.integration_id
    );
    if (matching.length === 0) {
      if (isScanResults({ name: policy.context, appId: policy.integration_id }))
        warnings.push(
          `${policy.context} reported no results; the scanner did not run`
        );
      continue;
    }
    for (const check of matching)
      if (scannerUnavailable(check))
        warnings.push(
          `${check.name} could not run (${check.conclusion ?? check.status}); not blocking`
        );
  }
  return [...new Set(warnings)];
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
    const present = checks.some(
      (check) =>
        check.name === policy.context && check.appId === policy.integration_id
    );
    const absenceTolerated =
      policy.advisory === true ||
      (policy.outage_tolerant === true &&
        (!isScanResults({
          name: policy.context,
          appId: policy.integration_id,
        }) ||
          scanResultsCannotArrive(required, checks)));
    if (!present && !absenceTolerated)
      failures.push(
        `Missing required check: ${policy.context} (app ${policy.integration_id})`
      );
  }
  for (const check of checks) {
    if (aggregate(check)) continue;
    const shard =
      check.appId === ACTIONS &&
      (SHARD.test(check.name) || UNEXPANDED_SHARD.has(check.name));
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
    const tolerated =
      required.some(
        (policy) =>
          policy.outage_tolerant === true &&
          policy.context === check.name &&
          policy.integration_id === check.appId
      ) && scannerUnavailable(check);
    if (tolerated) continue;
    // Waited for like any other check; only its verdict is advisory.
    if (advisory(required, check) && check.status === 'completed') continue;
    const cachedShard =
      emptyShardPlan &&
      UNEXPANDED_SHARD.has(check.name) &&
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
