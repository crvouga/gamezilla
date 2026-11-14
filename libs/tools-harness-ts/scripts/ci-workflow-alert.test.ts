import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { failureIssueTitle } from './ci-failure-issue';
import {
  formatWorkflowMarkdown,
  jobVerdicts,
  redJobs,
} from './ci-workflow-alert';

// regression: release-red-for-days-unnoticed
test('a failed, cancelled or unreported job makes the run red; a skipped one does not', () => {
  const verdicts = jobVerdicts({
    'deploy-dev': { result: 'failure' },
    'deploy-prd': { result: 'skipped' },
    verify: { result: 'success' },
    health: { result: 'cancelled' },
    lost: {},
  });
  expect(redJobs(verdicts).map((v) => v.job)).toEqual([
    'deploy-dev',
    'health',
    'lost',
  ]);
  expect(
    redJobs(jobVerdicts({ a: { result: 'success' }, b: { result: 'skipped' } }))
  ).toEqual([]);
});

test('the issue names the workflow and links the run and its red jobs', () => {
  expect(failureIssueTitle('Release')).toBe('Release is failing on main');
  const markdown = formatWorkflowMarkdown({
    workflow: 'Release',
    verdicts: jobVerdicts({ 'deploy-dev': { result: 'failure' } }),
    url: 'https://github.com/o/r/actions/runs/1',
    sha: 'abc',
  });
  expect(markdown).toContain('❌ Release');
  expect(markdown).toContain('https://github.com/o/r/actions/runs/1');
  expect(markdown).toContain('| `deploy-dev` | **failure** |');
  expect(markdown).toContain('Grafana');
});

type Job = {
  readonly needs?: readonly string[] | string;
  readonly if?: string;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly steps?: readonly { readonly name?: string; readonly run?: string }[];
};

function workflow(file: string): {
  readonly jobs: Readonly<Record<string, Job>>;
} {
  return Bun.YAML.parse(
    readFileSync(join(ROOT, '.github/workflows', file), 'utf8')
  ) as { readonly jobs: Readonly<Record<string, Job>> };
}

function runs(job: Job | undefined): string {
  return (job?.steps ?? []).map((step) => step.run ?? '').join('\n');
}

const ROOT = join(import.meta.dirname, '../../..');

// regression: release-red-for-days-unnoticed
test.each([
  ['deploy.yml', 'deploy-verdict', 'release'],
  ['health.yml', 'health-verdict', 'health'],
  ['verify-nightly.yml', 'verify-nightly-end', 'verify-nightly'],
])(
  '%s files its failure issue and records its result in Grafana after every job',
  (file, jobName, metricName) => {
    const { jobs } = workflow(file);
    const job = jobs[jobName];
    expect(job).toBeDefined();
    const needs = [job?.needs ?? []].flat();
    expect([...needs].sort()).toEqual(
      Object.keys(jobs)
        .filter((name) => name !== jobName && !OUTSIDE_VERDICT.has(name))
        .sort()
    );
    expect(job?.permissions?.['issues']).toBe('write');
    expect(job?.permissions?.['id-token']).toBe('write');
    expect(runs(job)).toMatch(
      /ci-workflow-alert\.ts|verify-nightly-verdict\.ts/
    );
    expect(runs(job)).toContain(
      `ci-workflow-result.ts --workflow ${metricName}`
    );
  }
);

/** Jobs that are not about `main`'s release health: rehearsals and housekeeping. */
const OUTSIDE_VERDICT = new Set(['deploy-rehearsal', 'health-cleanup']);

// regression: release-timeout-spent-waiting-for-health
test("waiting for a running Health check never spends an environment's release timeout", () => {
  const { jobs } = workflow('deploy.yml');
  for (const name of ['deploy-dev', 'deploy-prd'])
    expect(runs(jobs[name])).not.toContain('workflow health.yml');
  expect(runs(jobs['deploy-await-health'])).toContain('workflow health.yml');
  expect(jobs['deploy-fleet']?.needs).toContain('deploy-await-health');
});
