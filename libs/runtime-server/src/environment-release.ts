/**
 * Decisions for preparing an environment and putting out a release.
 * The facts come from the shipped preparation and release definitions;
 * these functions only say what those facts mean for the team.
 */

export type ReleasePolicy = {
  readonly shipNeedsPassingCheck: boolean;
  readonly newerProposalReplacesCheck: boolean;
  readonly releaseCheckIsNotReplaced: boolean;
  readonly underwayIsNotCancelled: boolean;
  readonly noUndoOfStartedRelease: boolean;
  readonly preparationFailureIsTold: boolean;
  readonly preparationFailureStillOpens: boolean;
};

export function preparationOutcome(policy: ReleasePolicy): 'told-and-open' {
  if (!policy.preparationFailureIsTold || !policy.preparationFailureStillOpens)
    throw new Error(
      'A failed preparation must tell the team and still open the environment'
    );
  return 'told-and-open';
}

export function releaseAfterCheck(
  policy: ReleasePolicy,
  check: 'passed' | 'failed'
): 'finished' | 'refused' {
  if (!policy.shipNeedsPassingCheck)
    throw new Error('A release must wait for a passing release check');
  return check === 'passed' ? 'finished' : 'refused';
}

export function checkReplacement(
  policy: ReleasePolicy,
  kind: 'proposal' | 'release'
): 'replaced' | 'kept' {
  if (!policy.newerProposalReplacesCheck)
    throw new Error(
      'A newer check of the same change must replace the one still running'
    );
  if (!policy.releaseCheckIsNotReplaced)
    throw new Error("One release must not replace another release's check");
  return kind === 'proposal' ? 'replaced' : 'kept';
}

export function startedReleaseAfterCancel(
  policy: ReleasePolicy
): 'unfinished' {
  if (!policy.underwayIsNotCancelled || !policy.noUndoOfStartedRelease)
    throw new Error('A release that has started is not undone');
  return 'unfinished';
}
