/** Reuse the PR's required Check instead of cancelling it with a dispatch. */
type CheckRun = {
  readonly databaseId: number;
  readonly headSha: string;
  readonly conclusion: string | null;
};

type CheckRunPorts = {
  readonly run: (command: readonly string[]) => string;
  readonly sleep: (milliseconds: number) => Promise<unknown>;
};

export class CheckRunError extends Error {}

export async function pullRequestCheckRun(
  branch: string,
  sha: string,
  ports: CheckRunPorts
): Promise<number | null> {
  const prs = JSON.parse(
    ports.run([
      'gh',
      'pr',
      'list',
      '--head',
      branch,
      '--base',
      'main',
      '--state',
      'open',
      '--json',
      'headRefOid',
    ])
  ) as { readonly headRefOid: string }[];
  if (!prs.some((pr) => pr.headRefOid === sha)) return null;

  // The synchronize event can arrive after the push has returned.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const runs = JSON.parse(
      ports.run([
        'gh',
        'run',
        'list',
        '--workflow',
        'check.yml',
        '--branch',
        branch,
        '--event',
        'pull_request',
        '--limit',
        '20',
        '--json',
        'databaseId,headSha,conclusion',
      ])
    ) as CheckRun[];
    const found = runs
      .filter((candidate) => candidate.headSha === sha)
      .sort((a, b) => b.databaseId - a.databaseId)[0];
    if (found !== undefined) {
      // A cancelled run produced no verdict; resume it without retrying failures.
      if (found.conclusion === 'cancelled') {
        ports.run(['gh', 'run', 'rerun', String(found.databaseId)]);
      }
      return found.databaseId;
    }
    await ports.sleep(2000);
  }
  throw new CheckRunError(`No PR Check run appeared for ${sha.slice(0, 9)}.`);
}
