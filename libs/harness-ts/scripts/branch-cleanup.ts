export type CleanupBranch = { name: string; sha: string; protected: boolean };
export type CleanupPull = {
  branch: string;
  sha: string;
  state: string;
  merged: boolean;
  baseBranch: string;
  mergeSha: string | null;
};
export type BranchCleanupPort = {
  branches(): Promise<readonly CleanupBranch[]>;
  pulls(): Promise<readonly CleanupPull[]>;
  defaultBranch(): Promise<string>;
  compare(base: string, head: string): Promise<string>;
  head(branch: string): Promise<string>;
  remove(branch: string, expectedSha: string): Promise<void>;
};
export type CleanupReport = {
  eligible: string[];
  removed: string[];
  retained: { branch: string; reason: string }[];
};

const integrated = (comparison: string) =>
  comparison === 'behind' || comparison === 'identical';

async function retentionReason(
  port: BranchCleanupPort,
  branch: CleanupBranch,
  pulls: readonly CleanupPull[],
  base: string
): Promise<string | null> {
  if (branch.protected || branch.name === base)
    return 'protected or default branch';
  const related = pulls.filter((pull) => pull.branch === branch.name);
  if (related.some((pull) => pull.state === 'open')) return 'open PR';
  if (related.some((pull) => !pull.merged))
    return 'closed unmerged PR; explicit abandonment required';
  const proof = related.find(
    (pull) =>
      pull.merged &&
      pull.sha === branch.sha &&
      pull.baseBranch === base &&
      pull.mergeSha !== null
  );
  const included =
    proof?.mergeSha !== null &&
    proof?.mergeSha !== undefined &&
    integrated(await port.compare(base, proof.mergeSha));
  if (!included && !integrated(await port.compare(base, branch.sha)))
    return 'no merged or integrated proof; disposition required';
  if ((await port.head(branch.name)) !== branch.sha)
    return 'head advanced during inventory';
  return null;
}

/** Inventory first. Closed unmerged work is never an abandonment instruction. */
export async function cleanupBranches(
  port: BranchCleanupPort,
  apply: boolean
): Promise<CleanupReport> {
  const branches = await port.branches();
  const pulls = await port.pulls();
  const base = await port.defaultBranch();
  const inventory = [];
  for (const branch of branches)
    inventory.push({
      branch,
      reason: await retentionReason(port, branch, pulls, base),
    });
  const report: CleanupReport = { eligible: [], removed: [], retained: [] };
  for (const { branch, reason } of inventory) {
    if (reason !== null) {
      report.retained.push({ branch: branch.name, reason });
      continue;
    }
    report.eligible.push(branch.name);
    if (apply) {
      await port.remove(branch.name, branch.sha);
      report.removed.push(branch.name);
    }
  }
  return report;
}
