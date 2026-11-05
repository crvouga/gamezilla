// @io-wall-ok — checks the deployment contract without contacting providers.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Job = {
  needs?: string | string[];
  if?: string;
  concurrency?: { group: string; 'cancel-in-progress': boolean };
  steps: { run?: string }[];
};

function jobs(name: string): Record<string, Job> {
  const source = readFileSync(
    join(import.meta.dir, '../../../.github/workflows', name),
    'utf8'
  );
  return (Bun.YAML.parse(source) as { jobs: Record<string, Job> }).jobs;
}

// regression: alerting-bootstrap-never-reconciled
test('Release applies alerting after verification and Health detects drift under the same state lock', () => {
  const release = jobs('deploy.yml');
  const apply = release['deploy-repository-policy']!;
  const drift = jobs('health.yml')['health-repository-policy']!;
  expect(apply.needs).toBe('deploy-verify');
  expect(release['deploy-fleet']!.needs).toContain('deploy-repository-policy');
  for (const job of [apply, drift]) {
    expect(job.if).toContain("github.ref == 'refs/heads/main'");
    expect(job.concurrency).toEqual({
      group: 'repository-policy',
      'cancel-in-progress': false,
    });
  }
  expect(
    apply.steps.some((step) => step.run?.includes('#apply:alerting'))
  ).toBe(true);
  expect(
    drift.steps.some((step) => step.run?.includes('#drift:alerting'))
  ).toBe(true);
  expect(drift.steps.some((step) => step.run?.includes('#apply:'))).toBe(false);
  const rehearsal = release['deploy-rehearsal']!;
  expect(
    rehearsal.steps.some((step) => step.run?.includes('#plan:alerting'))
  ).toBe(true);
  expect(rehearsal.steps.some((step) => step.run?.includes('#apply:'))).toBe(
    false
  );
});
