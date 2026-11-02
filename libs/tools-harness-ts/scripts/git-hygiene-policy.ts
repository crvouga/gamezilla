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
  remoteSha: string | null;
};

/** A merged PR must account for exactly the current local head. */
export function retentionReason(branch: HygieneBranch): string | null {
  if (branch.name === 'main') return 'default branch';
  if (branch.worktree !== null)
    return `worktree still attached: ${branch.worktree}`;
  if (branch.pulls.some((pull) => pull.state === 'OPEN')) return 'open PR';
  if (branch.pulls.some((pull) => pull.state === 'CLOSED'))
    return 'closed unmerged PR; explicit abandonment required';
  if (branch.remoteSha !== null && branch.remoteSha !== branch.sha)
    return 'local and remote heads differ';
  const proof = branch.pulls.some(
    (pull) =>
      pull.state === 'MERGED' &&
      pull.headRefOid === branch.sha &&
      pull.baseRefName === 'main' &&
      pull.mergeCommit !== null
  );
  if (!proof) return 'no merged PR at this exact head targeting main';
  if (!branch.mergeIncluded) return 'merge commit absent from origin/main';
  return null;
}

export function githubRepository(remote: string): string {
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\.git)?$/u.exec(
      remote
    );
  if (!match?.[1]) throw new Error('Git hygiene requires a github.com origin');
  return match[1];
}
