import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every workflow run title has one shape — `<Workflow> · <trigger>`, never a
 * branch or ref (too dynamic to scan) — and every job is named `<prefix>` or `<prefix>:<stage>` after its id
 * (`<prefix>:<env>` for a job with an env matrix, the shard appended for a
 * job with a shard matrix), so
 * the Actions run list and the PR checks box read the same everywhere.
 */
const WORKFLOWS_DIR = join(import.meta.dirname, '../../../.github/workflows');
const SEPARATOR = ' · ';

/** The `<trigger>` label each event renders as. */
const TRIGGER_LABELS: Record<string, string> = {
  pull_request: "format('pr #{0}', github.event.pull_request.number)",
  push: "'push'",
  schedule: "'schedule'",
  workflow_dispatch: "'manual'",
};

type Workflow = {
  name: string;
  'run-name'?: string;
  on: Record<string, unknown>;
  jobs: Record<
    string,
    {
      name?: string;
      strategy?: { matrix?: { env?: unknown; shard?: unknown } };
    }
  >;
};

/**
 * Each workflow's display name and the prefix its jobs share. The merge
 * gate's jobs are `check:*` wherever it runs — a pull request, Deploy's
 * verification, the nightly run — so the required status `check:end` never
 * moves with a file name.
 */
const WORKFLOWS: Record<string, { name: string; jobs: string }> = {
  'check-nightly.yml': { name: 'Check Nightly', jobs: 'check-nightly' },
  'check-pr.yml': { name: 'Check PR', jobs: 'check' },
  'deploy.yml': { name: 'Deploy', jobs: 'deploy' },
  'health.yml': { name: 'Health', jobs: 'health' },
};

/** A job fanned out over the env files renders as `<prefix>:<env>`. */
const MATRIX_ENV = '${{ matrix.env }}';
/** A job fanned out over shards renders as `<prefix>:<stage> (<shard>)`. */
const SHARD = ' (${{ strategy.job-index }})';

const workflows = readdirSync(WORKFLOWS_DIR)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => ({
    file,
    workflow: Bun.YAML.parse(
      readFileSync(join(WORKFLOWS_DIR, file), 'utf8')
    ) as Workflow,
  }));

// regression: ci-provider-native-workflows-missing-auth
// regression: ci-provider-migration-workflow-on-feature-branch
test('Check PR, Check Nightly, Deploy and Health have one native workflow source', () => {
  expect(workflows.map(({ file }) => file)).not.toContain(
    'temporary-ci-migration.yml'
  );
  expect(workflows.map(({ file }) => file).sort()).toEqual(
    Object.keys(WORKFLOWS)
  );
});

describe.each(workflows)('$file', ({ file, workflow }) => {
  test('workflow name is the file stem in title case', () => {
    expect(workflow.name).toBe(WORKFLOWS[file]!.name);
    expect(workflow.name.toLowerCase().replaceAll(' ', '-')).toBe(
      file.replace(/\.yml$/u, '')
    );
  });

  test('run-name is `<Workflow> · <trigger>`', () => {
    const runName = workflow['run-name'] ?? '';
    const segments = runName.split(SEPARATOR);
    expect(segments).toHaveLength(2);
    expect(runName).not.toMatch(/github\.(head_|base_)?ref/u);
    expect(segments[0]).toBe(workflow.name);
    // GitHub never renders a called workflow's run-name: the caller's shows.
    for (const event of Object.keys(workflow.on).filter(
      (name) => name !== 'workflow_call'
    )) {
      const label = TRIGGER_LABELS[event];
      expect(label, `no trigger label for event ${event}`).toBeDefined();
      expect(segments[1]).toContain(label as string);
    }
  });

  test('jobs are named `<prefix>[:<stage>]` after their id, `<prefix>:<env>` per env, or with their shard', () => {
    const prefix = WORKFLOWS[file]!.jobs;
    for (const [id, job] of Object.entries(workflow.jobs)) {
      const perEnv = job.strategy?.matrix?.env !== undefined;
      const perShard = job.strategy?.matrix?.shard !== undefined;
      expect(id === prefix || id.startsWith(`${prefix}-`)).toBe(true);
      const stage = id === prefix ? '' : `:${id.slice(prefix.length + 1)}`;
      expect(job.name).toBe(
        perEnv
          ? `${prefix}:${MATRIX_ENV}`
          : `${prefix}${stage}${perShard ? SHARD : ''}`
      );
    }
  });
});
