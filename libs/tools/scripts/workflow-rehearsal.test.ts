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
  expect(workflow.jobs['deploy-matrix']?.if).toBe('${{ !inputs.rehearsal }}');
  expect(workflow.jobs['deploy-rehearsal']).toMatchObject({
    if: '${{ inputs.rehearsal }}',
    uses: './.github/workflows/check.yml',
  });
  expect(workflow.jobs['deploy-plan']).toMatchObject({
    if: '${{ inputs.rehearsal }}',
    needs: 'deploy-rehearsal',
  });
  const commands = workflow.jobs['deploy-plan']?.steps
    ?.flatMap((step) => (step.run ? [step.run] : []))
    .join('\n');
  expect(commands).toMatch(/\bplan:foundation\b/);
  expect(commands).not.toMatch(/apply|deploy:local|--recover-ci-identity/);
  expect(source).toContain('Deploy ships refs/heads/main only');
  expect(workflow.jobs['deploy-verify']?.needs).toBe('deploy-matrix');
});
