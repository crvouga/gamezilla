export type HygienePull = {
  state: string;
  headRefOid: string;
  baseRefName: string;
  mergeCommit: { oid: string } | null;
};

export type HygieneBranch = {
  name: string;
  sha: string;
  worktree: string | null;
  pulls: readonly HygienePull[];
  mergeIncluded: boolean;
  /**
   * True when `sha` is an ancestor of `origin/main`, or every commit
   * reachable from `sha` but not from `origin/main` is already on
   * `origin/main` (`git cherry` reports no unique patches).
   */
  integrated: boolean;
  /** True when `sha` is already a parent of `origin/archive`. */
  archived: boolean;
  /** True when the tip was committed at least `IDLE_DAYS` ago. */
  idle: boolean;
  remoteSha: string | null;
};

/** Matches remote maintenance: unmerged work newer than this stays. */
export const IDLE_DAYS = 3;

export type HygieneDecision = {
  /** Why the branch stays. Null means delete it. */
  reason: string | null;
  /**
   * Safe for `git branch -D`: the tip is on main, a merged PR at this exact
   * head is on main, or the idle tip is already on archive.
   */
  force: boolean;
};

/** A merged PR must account for exactly the current local head. */
export function hygieneDecision(branch: HygieneBranch): HygieneDecision {
  const keep = (reason: string): HygieneDecision => ({
    reason,
    force: false,
  });
  if (branch.name === 'main' || branch.name === 'archive')
    return keep('default or archive branch');
  if (branch.worktree !== null)
    return keep(`worktree still attached: ${branch.worktree}`);
  if (branch.pulls.some((pull) => pull.state === 'OPEN'))
    return keep('open PR');
  if (branch.remoteSha !== null && branch.remoteSha !== branch.sha)
    return keep('local and remote heads differ');
  // Squash merges do not keep the pre-merge head. Integration is enough:
  // a closed PR for that same head is the merged record, not abandoned work.
  if (branch.integrated) return { reason: null, force: true };
  // A tip already on `archive` is reachable after the local ref goes, once
  // nobody has committed to it inside the idle window.
  if (branch.archived && branch.idle) return { reason: null, force: true };
  if (branch.pulls.some((pull) => pull.state === 'CLOSED'))
    return keep('closed unmerged PR; explicit abandonment required');
  const proof = branch.pulls.some(
    (pull) =>
      pull.state === 'MERGED' &&
      pull.headRefOid === branch.sha &&
      pull.baseRefName === 'main' &&
      pull.mergeCommit !== null
  );
  if (!proof) return keep('no merged PR at this exact head targeting main');
  if (!branch.mergeIncluded)
    return keep('merge commit absent from origin/main');
  return { reason: null, force: true };
}

/** A merged PR must account for exactly the current local head. */
export function retentionReason(branch: HygieneBranch): string | null {
  return hygieneDecision(branch).reason;
}

export function githubRepository(remote: string): string {
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\.git)?$/u.exec(
      remote
    );
  if (!match?.[1]) throw new Error('Git hygiene requires a github.com origin');
  return match[1];
}
