import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflow = Bun.YAML.parse(
  readFileSync(
    join(import.meta.dir, '../../../.github/workflows/deploy.yml'),
    'utf8'
  )
) as { jobs: { 'deploy-prd': { steps: { name?: string; run?: string }[] } } };

// regression: push-rollout-reserves-full-foundation-time
test('push and full deployments reserve time for their actual rollout', () => {
  const step = workflow.jobs['deploy-prd'].steps.find(
    (step) => step.name === 'Check the release fits the time left'
  );
  if (!step?.run) throw new Error('Missing rollout admission command');
  const command = step.run;
  function admit(event: string, remaining: number) {
    return spawnSync('bash', ['-ec', 'date() { echo 0; }\n' + command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: event,
        GITHUB_ENV: '/dev/null',
        SECRETS_ENV: 'prd',
        CI_STAGE_DEADLINE: String(remaining),
      },
    });
  }
  const push = admit('push', 319);
  expect(push.status).toBe(0);
  expect(admit('push', 299).status).toBe(1);
  expect(admit('workflow_dispatch', 319).status).toBe(1);
  expect(admit('workflow_dispatch', 360).status).toBe(0);
});
