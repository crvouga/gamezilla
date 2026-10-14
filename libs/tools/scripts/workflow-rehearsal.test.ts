import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('Deploy rehearsal verifies and plans without opening the release path', () => {
  const source = readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/deploy.yml'),
    'utf8'
  );
  const workflow = Bun.YAML.parse(source) as {
    on: { workflow_dispatch: { inputs: { rehearsal: { default: boolean } } } };
    jobs: Record<
      string,
      {
        if?: string;
        needs?: string | string[];
        uses?: string;
        steps?: { run?: string }[];
      }
    >;
  };
  expect(workflow.on.workflow_dispatch.inputs.rehearsal.default).toBe(false);
  // One Check serves both paths; only the release path is switched off.
  expect(workflow.jobs['deploy-check']).toMatchObject({
    uses: './.github/workflows/check-pr.yml',
  });
  expect(workflow.jobs['deploy-check']?.if).toBeUndefined();
  expect(workflow.jobs['deploy-rehearsal']).toMatchObject({
    if: '${{ inputs.rehearsal }}',
    needs: 'deploy-check',
  });
  expect(workflow.jobs['deploy-fleet']?.if).toBe('${{ !inputs.rehearsal }}');
  expect(workflow.jobs['deploy-dev']?.needs).toBe('deploy-fleet');
  const commands = workflow.jobs['deploy-rehearsal']?.steps
    ?.flatMap((step) => (step.run ? [step.run] : []))
    .join('\n');
  expect(commands).toMatch(/\bplan:foundation\b/);
  expect(commands).toMatch(/\bplan:fleet\b/);
  expect(commands).not.toMatch(/apply|deploy:local|--recover-ci-identity/);
  expect(source).toContain('Deploy ships refs/heads/main only');
  expect(source).not.toContain('/pulls');
  expect(source).not.toContain('pull-requests:');
  expect(workflow.jobs['deploy-check']?.needs).toBe('deploy-guard');
});
