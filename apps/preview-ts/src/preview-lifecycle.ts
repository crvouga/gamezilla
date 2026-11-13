/**
 * What one CI run does to a pull request's Preview, decided from the event
 * that started the run and the pull request as it is *now*. Runs for one pull
 * request are serialised by the workflow's concurrency group; this decision is
 * what keeps a run that waited in that queue from acting on stale facts.
 */

import { FREE_PLAN } from './free-plan';
import { MAIN_PREVIEW_NAME, prOfPreviewName } from './preview-name';

export type PreviewTrigger =
  | {
      readonly kind: 'pull-request';
      readonly action: string;
      readonly pr: number;
      /** The commit this run checked out. */
      readonly sha: string;
      readonly fromFork: boolean;
    }
  /** A push to the main branch; `sha` is the commit this run checked out. */
  | { readonly kind: 'main'; readonly sha: string }
  | { readonly kind: 'sweep' };

export type PullRequestNow = {
  readonly open: boolean;
  readonly headSha: string;
};

export type PreviewAction =
  | { readonly kind: 'deploy'; readonly pr: number; readonly sha: string }
  | { readonly kind: 'destroy'; readonly pr: number }
  | { readonly kind: 'deploy-main'; readonly sha: string }
  | { readonly kind: 'sweep' }
  | { readonly kind: 'skip'; readonly reason: string };

/**
 * What a push to the main branch does, given the branch's head as it is now:
 * like a pull request's, an older commit never replaces a newer one.
 */
export function decideMainAction(
  sha: string,
  headSha: string | null
): PreviewAction {
  if (headSha === null)
    return { kind: 'skip', reason: 'the main branch could not be read' };
  if (headSha !== sha)
    return {
      kind: 'skip',
      reason: `commit ${sha.slice(0, 12)} is no longer the head of main (${headSha.slice(0, 12)})`,
    };
  return { kind: 'deploy-main', sha };
}

export function decidePreviewAction(
  trigger: Exclude<PreviewTrigger, { readonly kind: 'main' }>,
  now: PullRequestNow | null
): PreviewAction {
  if (trigger.kind === 'sweep') return { kind: 'sweep' };
  // A fork's code never meets the deploy credential.
  if (trigger.fromFork)
    return { kind: 'skip', reason: 'pull request comes from a fork' };
  if (now === null)
    return { kind: 'skip', reason: 'pull request could not be read' };
  // Closed wins whatever started the run: a deploy queued behind a close must
  // not bring the Preview back.
  if (!now.open) return { kind: 'destroy', pr: trigger.pr };
  if (trigger.action === 'closed')
    return { kind: 'skip', reason: 'pull request was reopened' };
  // An older commit never replaces a newer one: the run for the newer head
  // deploys it.
  if (now.headSha !== trigger.sha)
    return {
      kind: 'skip',
      reason: `commit ${trigger.sha.slice(0, 12)} is no longer the head (${now.headSha.slice(0, 12)})`,
    };
  return { kind: 'deploy', pr: trigger.pr, sha: trigger.sha };
}

/**
 * Whether a bundle that fails its checks on disk (the gate) is still
 * uploaded. A pull request's Preview is best effort: whatever was built goes
 * up, so the Preview always shows the latest commit, failing checks and all.
 * The main branch's is strict: a commit that fails its gate never replaces
 * the last working `preview.<domain>`.
 */
export function uploadsDespiteGate(previewName: string): boolean {
  return previewName !== MAIN_PREVIEW_NAME;
}

/**
 * Why an uploaded site is failing its checks, from the gate on disk and the
 * checks of what is served; `null` when both passed.
 */
export function failingChecks(checks: {
  readonly gate: string | null;
  readonly served: string | null;
}): string | null {
  const reasons = [
    ...(checks.gate === null ? [] : [`before upload: ${checks.gate}`]),
    ...(checks.served === null ? [] : [`served: ${checks.served}`]),
  ];
  return reasons.length === 0 ? null : reasons.join('; ');
}

/**
 * Previews of open pull requests are kept this long after their last update.
 * A week: a pull request nobody has touched for that long is not being
 * reviewed from its Preview, and the next commit or a reopen brings it back.
 */
export const PREVIEW_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The most Previews kept at once. The free plan holds a fixed number per
 * Worker and refuses the upload after it, so a sweep keeps under it with
 * room for the pull requests opened before the next one.
 */
export const PREVIEW_CAPACITY = FREE_PLAN.previewsPerWorker - 20;

export type OpenPullRequest = {
  readonly pr: number;
  readonly updatedAtMs: number;
};

export type SweepPlan = {
  /** The pull request is closed, merged or gone. */
  readonly orphaned: readonly string[];
  /**
   * The pull request is open but has not changed within the retention, or
   * is among the least recently changed of more than the capacity.
   */
  readonly expired: readonly string[];
};

/**
 * Which Previews a sweep removes. Names this tooling never made are left
 * alone: a sweep only deletes what the lifecycle created.
 */
export function planSweep(args: {
  readonly previewNames: readonly string[];
  readonly open: readonly OpenPullRequest[];
  readonly nowMs: number;
  readonly retentionMs: number;
  /** The most Previews left standing, counting the names it never made. */
  readonly capacity: number;
}): SweepPlan {
  const open = new Map(args.open.map((pull) => [pull.pr, pull.updatedAtMs]));
  const orphaned: string[] = [];
  const expired: string[] = [];
  const kept: { readonly name: string; readonly updatedAtMs: number }[] = [];
  let foreign = 0;
  for (const name of args.previewNames.toSorted()) {
    const pr = prOfPreviewName(name);
    if (pr === null) {
      foreign += 1;
      continue;
    }
    const updatedAtMs = open.get(pr);
    if (updatedAtMs === undefined) orphaned.push(name);
    else if (args.nowMs - updatedAtMs > args.retentionMs) expired.push(name);
    else kept.push({ name, updatedAtMs });
  }
  // Over capacity, the pull requests longest without a change go first.
  const crowded = Math.max(0, kept.length + foreign - args.capacity);
  const longestUnchanged = kept.toSorted(
    (a, b) => a.updatedAtMs - b.updatedAtMs
  );
  for (const { name } of longestUnchanged.slice(0, crowded)) expired.push(name);
  return { orphaned, expired: expired.toSorted() };
}
