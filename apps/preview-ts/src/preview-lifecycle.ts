/**
 * What one CI run does to a pull request's Preview, decided from the event
 * that started the run and the pull request as it is *now*. Runs for one pull
 * request are serialised by the workflow's concurrency group; this decision is
 * what keeps a run that waited in that queue from acting on stale facts.
 */

import { prOfPreviewName } from './preview-name';

export type PreviewTrigger =
  | {
      readonly kind: 'pull-request';
      readonly action: string;
      readonly pr: number;
      /** The commit this run checked out. */
      readonly sha: string;
      readonly fromFork: boolean;
    }
  | { readonly kind: 'sweep' };

export type PullRequestNow = {
  readonly open: boolean;
  readonly headSha: string;
};

export type PreviewAction =
  | { readonly kind: 'deploy'; readonly pr: number; readonly sha: string }
  | { readonly kind: 'destroy'; readonly pr: number }
  | { readonly kind: 'sweep' }
  | { readonly kind: 'skip'; readonly reason: string };

export function decidePreviewAction(
  trigger: PreviewTrigger,
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

/** Previews of open pull requests are kept this long after their last update. */
export const PREVIEW_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export type OpenPullRequest = {
  readonly pr: number;
  readonly updatedAtMs: number;
};

export type SweepPlan = {
  /** The pull request is closed, merged or gone. */
  readonly orphaned: readonly string[];
  /** The pull request is open but has not changed within the retention. */
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
}): SweepPlan {
  const open = new Map(args.open.map((pull) => [pull.pr, pull.updatedAtMs]));
  const orphaned: string[] = [];
  const expired: string[] = [];
  for (const name of args.previewNames.toSorted()) {
    const pr = prOfPreviewName(name);
    if (pr === null) continue;
    const updatedAtMs = open.get(pr);
    if (updatedAtMs === undefined) orphaned.push(name);
    else if (args.nowMs - updatedAtMs > args.retentionMs) expired.push(name);
  }
  return { orphaned, expired };
}
