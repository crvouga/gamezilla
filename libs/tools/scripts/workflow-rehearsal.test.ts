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
  // One Verification serves both paths; only the release path is switched off.
  expect(workflow.jobs['deploy-verify']).toMatchObject({
    uses: './.github/workflows/verify-pr.yml',
  });
  expect(workflow.jobs['deploy-verify']?.if).toBeUndefined();
  expect(workflow.jobs['deploy-rehearsal']).toMatchObject({
    if: '${{ inputs.rehearsal }}',
    needs: 'deploy-verify',
  });
  // regression: rehearsal-uses-main-only-aws-role
  expect(workflow.jobs['deploy-rehearsal']).toMatchObject({
    env: { AWS_ROLE_ARN: '${{ vars.AWS_HEALTH_ROLE_ARN }}' },
  });
  expect(workflow.jobs['deploy-fleet']?.if).toBe('${{ !inputs.rehearsal }}');
  expect(workflow.jobs['deploy-dev']?.needs).toBe('deploy-fleet');
  const commands = workflow.jobs['deploy-rehearsal']?.steps
    ?.flatMap((step) => (step.run ? [step.run] : []))
    .join('\n');
  expect(commands).toMatch(/\bplan:foundation\b/);
  expect(commands).toMatch(/\bplan:fleet\b/);
  expect(commands).not.toMatch(/apply|deploy:local|--recover-ci-identity/);
  expect(source).not.toContain('deploy-guard:');
  expect(source).not.toContain('/pulls');
  expect(source).not.toContain('pull-requests:');
  expect(workflow.jobs['deploy-verify']?.needs).toBeUndefined();
  expect(workflow.jobs['deploy-verify']).toHaveProperty(
    'with.require-main',
    '${{ !inputs.rehearsal }}'
  );
  const verify = Bun.YAML.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.github/workflows/verify-pr.yml'),
      'utf8'
    )
  ) as {
    jobs: Record<
      string,
      { steps: { name?: string; if?: string; run?: string }[] }
    >;
  };
  expect(verify.jobs['verify-start']?.steps[0]).toMatchObject({
    name: 'Validate release branch',
    if: '${{ inputs.require-main }}',
  });
  expect(verify.jobs['verify-start']?.steps[0]?.run).toContain(
    'refs/heads/main'
  );
});
