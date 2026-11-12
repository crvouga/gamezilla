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
  /** Committer time of `sha`, in epoch milliseconds. */
  committedAt(sha: string): Promise<number>;
  /** Makes `sha` reachable from the archive branch, fast-forward only. */
  archive(branch: string, sha: string): Promise<void>;
  remove(branch: string, expectedSha: string): Promise<void>;
  now(): number;
};
export type CleanupReport = {
  eligible: string[];
  archived: string[];
  removed: string[];
  retained: { branch: string; reason: string }[];
};

/** Holds every deleted unmerged tip, so SHA-pinned links and old work stay reachable. */
export const ARCHIVE_BRANCH = 'archive';
/** Unmerged work with no open PR and no commit for this long is archived. */
export const IDLE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const integrated = (comparison: string) =>
  comparison === 'behind' || comparison === 'identical';

type Disposition =
  | { kind: 'retain'; reason: string }
  | { kind: 'remove' }
  | { kind: 'archive' };

async function disposition(
  port: BranchCleanupPort,
  branch: CleanupBranch,
  pulls: readonly CleanupPull[],
  base: string
): Promise<Disposition> {
  if (
    branch.protected ||
    branch.name === base ||
    branch.name === ARCHIVE_BRANCH
  )
    return { kind: 'retain', reason: 'protected, default or archive branch' };
  const related = pulls.filter((pull) => pull.branch === branch.name);
  if (related.some((pull) => pull.state === 'open'))
    return { kind: 'retain', reason: 'open PR' };
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
  const merged = included || integrated(await port.compare(base, branch.sha));
  if (!merged) {
    const idleMs = port.now() - (await port.committedAt(branch.sha));
    if (idleMs < IDLE_DAYS * DAY_MS)
      return {
        kind: 'retain',
        reason: `unmerged, no open PR, active within ${IDLE_DAYS} days`,
      };
  }
  if ((await port.head(branch.name)) !== branch.sha)
    return { kind: 'retain', reason: 'head advanced during inventory' };
  return { kind: merged ? 'remove' : 'archive' };
}

/**
 * Inventory first. Integrated branches are deleted; idle unmerged branches
 * (closed PR, diverged after merge, or never opened) are archived, then deleted.
 * Nothing is deleted unless its tip is in `main` or on the archive branch.
 */
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
      disposition: await disposition(port, branch, pulls, base),
    });
  const report: CleanupReport = {
    eligible: [],
    archived: [],
    removed: [],
    retained: [],
  };
  for (const { branch, disposition: decided } of inventory) {
    if (decided.kind === 'retain') {
      report.retained.push({ branch: branch.name, reason: decided.reason });
      continue;
    }
    report.eligible.push(branch.name);
    if (!apply) continue;
    if (decided.kind === 'archive') {
      await port.archive(branch.name, branch.sha);
      report.archived.push(branch.name);
    }
    await port.remove(branch.name, branch.sha);
    report.removed.push(branch.name);
  }
  return report;
}
