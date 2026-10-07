/** GitHub Actions discovery and verdicts, with process I/O supplied by the CLI. */
export type GitHubWorkflow = {
  readonly databaseId: number;
  readonly headSha: string;
  readonly status: string;
  readonly conclusion: string;
  readonly createdAt: string;
  readonly url: string;
  readonly event: string;
};
export type GitHubPorts = {
  readonly run: (command: readonly string[]) => string;
  readonly sleep: (milliseconds: number) => Promise<unknown>;
  readonly log: (message: string) => void;
  readonly onWorkflow: (workflow: GitHubWorkflow) => void;
};
export type GitHubTarget = {
  readonly repository: string;
  readonly workflow: string;
  readonly branch: string;
  readonly sha: string;
  readonly automatic: boolean;
  /** `workflow_dispatch` inputs, passed as `-f name=value`. */
  readonly inputs: Readonly<Record<string, string>>;
};

/** Fork checkouts must discover PRs on the configured repository, not its upstream. */
export function hasAutomaticCheck(
  target: Pick<GitHubTarget, 'repository' | 'branch' | 'sha'>,
  ports: Pick<GitHubPorts, 'run'>
): boolean {
  const prs = JSON.parse(
    ports.run([
      'gh',
      'pr',
      'list',
      '--repo',
      target.repository,
      '--head',
      target.branch,
      '--base',
      'main',
      '--state',
      'open',
      '--json',
      'headRefOid',
    ])
  ) as readonly { headRefOid: string }[];
  return prs.some((pr) => pr.headRefOid === target.sha);
}

export function selectWorkflow(
  workflows: readonly GitHubWorkflow[],
  sha: string
): GitHubWorkflow | undefined {
  return workflows
    .filter((candidate) => candidate.headSha === sha)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

export function listWorkflows(
  target: GitHubTarget,
  ports: GitHubPorts
): readonly GitHubWorkflow[] {
  return JSON.parse(
    ports.run([
      'gh',
      'run',
      'list',
      '--repo',
      target.repository,
      '--workflow',
      target.workflow,
      '--branch',
      target.branch,
      '--limit',
      '200',
      '--json',
      'databaseId,headSha,status,conclusion,createdAt,url,event',
    ])
  ) as GitHubWorkflow[];
}

export async function startWorkflow(
  target: GitHubTarget,
  ports: GitHubPorts
): Promise<GitHubWorkflow> {
  let existing = selectWorkflow(listWorkflows(target, ports), target.sha);
  if (target.workflow === 'check.yml' && target.automatic) {
    for (let attempt = 0; existing === undefined && attempt < 30; attempt++) {
      await ports.sleep(2000);
      existing = selectWorkflow(listWorkflows(target, ports), target.sha);
    }
    if (existing === undefined)
      throw new Error(
        `No PR Check run appeared for ${target.sha.slice(0, 9)}.`
      );
  }
  // A full verification is always a fresh dispatch: a PR's run on the same
  // commit is the fast gate, not the release verdict.
  if (
    target.workflow === 'check.yml' &&
    existing !== undefined &&
    target.inputs['scope'] !== 'full'
  ) {
    ports.onWorkflow(existing);
    if (existing.conclusion === 'cancelled') {
      ports.run([
        'gh',
        'run',
        'rerun',
        String(existing.databaseId),
        '--repo',
        target.repository,
      ]);
      await ports.sleep(2000);
    }
    return existing;
  }
  ports.run([
    'gh',
    'workflow',
    'run',
    target.workflow,
    '--repo',
    target.repository,
    '--ref',
    target.branch,
    ...Object.entries(target.inputs).flatMap(([name, value]) => [
      '-f',
      `${name}=${value}`,
    ]),
  ]);
  for (let attempt = 0; attempt < 30; attempt++) {
    const found = selectWorkflow(listWorkflows(target, ports), target.sha);
    if (found !== undefined && found.databaseId !== existing?.databaseId) {
      ports.onWorkflow(found);
      return found;
    }
    await ports.sleep(2000);
  }
  throw new Error(
    `No ${target.workflow} run appeared for ${target.sha.slice(0, 9)}`
  );
}

type RunStatus = {
  readonly status: string;
  readonly conclusion: string;
  readonly jobs: readonly {
    readonly name: string;
    readonly status: string;
    readonly conclusion: string;
  }[];
};

export async function watchWorkflow(
  workflow: GitHubWorkflow,
  target: GitHubTarget,
  ports: GitHubPorts
): Promise<number> {
  let previous = '';
  for (let attempt = 0; attempt < 1800; attempt++) {
    const status = JSON.parse(
      ports.run([
        'gh',
        'run',
        'view',
        String(workflow.databaseId),
        '--repo',
        target.repository,
        '--json',
        'status,conclusion,jobs',
      ])
    ) as RunStatus;
    const summary = `${status.status}: ${status.jobs.map((job) => `${job.name}=${job.conclusion || job.status}`).join(', ')}`;
    if (summary !== previous) ports.log(summary);
    previous = summary;
    const gate =
      target.workflow === 'check.yml'
        ? status.jobs.find((job) => job.name === 'check')
        : undefined;
    if (gate?.status === 'completed')
      return gate.conclusion === 'success' ? 0 : 1;
    if (status.conclusion === 'cancelled') {
      const next = selectWorkflow(
        listWorkflows(target, ports).filter(
          (candidate) => candidate.conclusion !== 'cancelled'
        ),
        target.sha
      );
      if (
        next !== undefined &&
        Date.parse(next.createdAt) > Date.parse(workflow.createdAt)
      ) {
        workflow = next;
        ports.onWorkflow(next);
        continue;
      }
    }
    if (status.status === 'completed') {
      if (status.conclusion === 'failure')
        ports.log(
          ports
            .run([
              'gh',
              'run',
              'view',
              String(workflow.databaseId),
              '--repo',
              target.repository,
              '--log-failed',
            ])
            .split('\n')
            .slice(-200)
            .join('\n')
        );
      return status.conclusion === 'success' ? 0 : 1;
    }
    await ports.sleep(2000);
  }
  throw new Error('GitHub workflow did not finish within one hour');
}
