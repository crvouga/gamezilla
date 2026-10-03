/** Native Depot discovery and verdicts, with process I/O supplied by the CLI. */
export type DepotWorkflow = {
  readonly workflow_id: string;
  readonly run_id: string;
  readonly workflow_path: string;
  readonly name: string;
  readonly head_sha: string;
  readonly sha: string;
  readonly status: string;
  readonly created_at: string;
};

export type DepotPorts = {
  readonly run: (command: readonly string[]) => string;
  readonly sleep: (milliseconds: number) => Promise<unknown>;
  readonly log: (message: string) => void;
  readonly onWorkflow: (workflow: DepotWorkflow) => void;
};

export type DepotTarget = {
  readonly repository: string;
  readonly org: string;
  readonly workflow: string;
  readonly branch: string;
  readonly sha: string;
  readonly automatic: boolean;
};

export function selectWorkflow(
  workflows: readonly DepotWorkflow[],
  workflow: string,
  sha: string
): DepotWorkflow | undefined {
  const name = workflow.replace(/\.ya?ml$/, '').toLowerCase();
  return workflows
    .filter(
      (candidate) =>
        (candidate.head_sha || candidate.sha) === sha &&
        (candidate.workflow_path.split('/').at(-1) === workflow ||
          candidate.name.toLowerCase() === name)
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
}

export function listWorkflows(
  target: DepotTarget,
  ports: DepotPorts
): readonly DepotWorkflow[] {
  return JSON.parse(
    ports.run([
      'depot',
      'ci',
      'workflow',
      'list',
      '--org',
      target.org,
      '--repo',
      target.repository,
      '-n',
      '200',
      '-o',
      'json',
    ])
  ) as DepotWorkflow[];
}

function dispatchCommand(target: DepotTarget): readonly string[] {
  const common = ['depot', 'ci'];
  const repository = ['--org', target.org, '--repo', target.repository];
  return target.workflow === 'deploy.yml'
    ? [
        ...common,
        'dispatch',
        ...repository,
        '--workflow',
        target.workflow,
        '--ref',
        target.branch,
      ]
    : [
        ...common,
        'run',
        ...repository,
        '--workflow',
        `.depot/workflows/${target.workflow}`,
      ];
}

/** Before native triggers merge to main, execute the branch's local YAML. */
export async function startWorkflow(
  target: DepotTarget,
  ports: DepotPorts
): Promise<DepotWorkflow> {
  let existing = selectWorkflow(
    listWorkflows(target, ports),
    target.workflow,
    target.sha
  );
  if (target.workflow === 'check.yml' && target.automatic) {
    for (
      let attempt = 0;
      existing === undefined && attempt < 30;
      attempt += 1
    ) {
      await ports.sleep(2000);
      existing = selectWorkflow(
        listWorkflows(target, ports),
        target.workflow,
        target.sha
      );
    }
    if (existing === undefined)
      throw new Error(
        `No PR Check run appeared for ${target.sha.slice(0, 9)}.`
      );
  }
  if (target.workflow === 'check.yml' && existing !== undefined) {
    ports.onWorkflow(existing);
    if (existing.status === 'cancelled') {
      ports.run([
        'depot',
        'ci',
        'rerun',
        existing.run_id,
        '--workflow',
        existing.workflow_id,
        '--org',
        target.org,
      ]);
      await ports.sleep(2000);
    }
    return existing;
  }
  return dispatchWorkflow(target, ports, existing?.workflow_id);
}

async function dispatchWorkflow(
  target: DepotTarget,
  ports: DepotPorts,
  previousId: string | undefined
): Promise<DepotWorkflow> {
  ports.run(dispatchCommand(target));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const found = selectWorkflow(
      listWorkflows(target, ports),
      target.workflow,
      target.sha
    );
    if (found !== undefined && found.workflow_id !== previousId) {
      ports.onWorkflow(found);
      return found;
    }
    await ports.sleep(2000);
  }
  throw new Error(
    `No native ${target.workflow} run appeared for ${target.sha.slice(0, 9)}`
  );
}

type NativeStatus = {
  readonly status: string;
  readonly workflows: readonly {
    readonly workflow_id: string;
    readonly status: string;
    readonly jobs: readonly {
      readonly job_id: string;
      readonly job_display_name: string;
      readonly status: string;
    }[];
  }[];
};

export async function watchWorkflow(
  workflow: DepotWorkflow,
  target: DepotTarget,
  ports: DepotPorts
): Promise<number> {
  let previous = '';
  for (let attempt = 0; attempt < 1800; attempt += 1) {
    const status = JSON.parse(
      ports.run([
        'depot',
        'ci',
        'status',
        workflow.run_id,
        '--org',
        target.org,
        '-o',
        'json',
      ])
    ) as NativeStatus;
    const selected = status.workflows.find(
      (item) => item.workflow_id === workflow.workflow_id
    );
    if (selected === undefined)
      throw new Error('Native workflow disappeared from its run');
    const summary = `${selected.status}: ${selected.jobs.map((job) => `${job.job_display_name}=${job.status}`).join(', ')}`;
    if (summary !== previous) ports.log(summary);
    previous = summary;
    // Check's required verdict is independent of nonessential publication.
    const gate =
      target.workflow === 'check.yml'
        ? selected.jobs.find((job) => job.job_display_name === 'check')
        : undefined;
    if (gate?.status === 'finished') return 0;
    if (gate?.status === 'failed' || gate?.status === 'cancelled') return 1;
    if (selected.status === 'finished') return 0;
    if (selected.status === 'cancelled') {
      const next = selectWorkflow(
        listWorkflows(target, ports).filter(
          (candidate) => candidate.status !== 'cancelled'
        ),
        target.workflow,
        target.sha
      );
      if (
        next !== undefined &&
        Date.parse(next.created_at) > Date.parse(workflow.created_at)
      ) {
        workflow = next;
        ports.onWorkflow(next);
        continue;
      }
    }
    if (selected.status === 'failed' || selected.status === 'cancelled') {
      for (const job of selected.jobs.filter(
        (job) => job.status === 'failed'
      )) {
        ports.log(
          ports
            .run(['depot', 'ci', 'logs', job.job_id, '--org', target.org])
            .split('\n')
            .slice(-200)
            .join('\n')
        );
      }
      return 1;
    }
    await ports.sleep(2000);
  }
  throw new Error('Native workflow did not finish within one hour');
}
