export type CleanupBranch = { name: string; sha: string; protected: boolean };
export type CleanupPull = {
  branch: string;
  sha: string;
  state: string;
  merged: boolean;
};
export type BranchCleanupPort = {
  branches(): Promise<readonly CleanupBranch[]>;
  pulls(): Promise<readonly CleanupPull[]>;
  defaultBranch(): Promise<string>;
  compare(base: string, head: string): Promise<string>;
  head(branch: string): Promise<string>;
  remove(branch: string): Promise<void>;
};

/** Only remove integrated heads or an unchanged head of a finished PR. */
export async function cleanupBranches(
  port: BranchCleanupPort,
  apply: boolean
): Promise<readonly string[]> {
  const branches = await port.branches();
  const pulls = await port.pulls();
  const base = await port.defaultBranch();
  const removed: string[] = [];
  for (const branch of branches) {
    if (
      branch.protected ||
      branch.name === base ||
      pulls.some((pull) => pull.branch === branch.name && pull.state === 'open')
    )
      continue;
    const finished = pulls.some(
      (pull) =>
        pull.branch === branch.name &&
        pull.sha === branch.sha &&
        pull.state === 'closed'
    );
    const comparison = await port.compare(base, branch.sha);
    if (!finished && comparison !== 'behind' && comparison !== 'identical')
      continue;
    // A branch reused after merge or advanced during the inventory is work.
    if ((await port.head(branch.name)) !== branch.sha) continue;
    if (apply) await port.remove(branch.name);
    removed.push(branch.name);
  }
  return removed;
}
