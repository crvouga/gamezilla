import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every workflow run title has one shape — `<Workflow> · <trigger>`, never a
 * branch or ref (too dynamic to scan) — and every job is named `<workflow>` or `<workflow>:<stage>` after its id
 * (`<workflow>:<env>` for a job with an env matrix), so
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
    { name?: string; strategy?: { matrix?: { env?: unknown } } }
  >;
};

/** A job fanned out over the env files renders as `<workflow>:<env>`. */
const MATRIX_ENV = '${{ matrix.env }}';

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
test('Check, Deploy and Health have one native workflow source', () => {
  expect(workflows.map(({ file }) => file)).not.toContain(
    'temporary-ci-migration.yml'
  );
  expect(workflows.map(({ file }) => file).sort()).toEqual([
    'check.yml',
    'deploy.yml',
    'health.yml',
  ]);
});

describe.each(workflows)('$file', ({ file, workflow }) => {
  test('workflow name is the capitalized file stem', () => {
    const stem = file.replace(/\.yml$/u, '');
    expect(workflow.name).toBe(stem.charAt(0).toUpperCase() + stem.slice(1));
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

  test('jobs are named `<workflow>[:<stage>]` after their id, or `<workflow>:<env>` per env', () => {
    const prefix = workflow.name.toLowerCase();
    for (const [id, job] of Object.entries(workflow.jobs)) {
      const perEnv = job.strategy?.matrix?.env !== undefined;
      expect(job.name).toBe(
        perEnv ? `${prefix}:${MATRIX_ENV}` : id.replace('-', ':')
      );
      expect(id === prefix || id.startsWith(`${prefix}-`)).toBe(true);
    }
  });
});
