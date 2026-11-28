import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// regression: release-workflow-commit-tag-forbidden
test('publishing a verified workflow commit uses the protected repository credential', () => {
  const source = readFileSync(
    new URL('../../../.github/workflows/deploy.yml', import.meta.url),
    'utf8'
  );
  const workflow: unknown = Bun.YAML.parse(source);
  expect(workflow).toHaveProperty('jobs.deploy-prd.environment', 'production');
  expect(workflow).toHaveProperty(
    'jobs.deploy-prd.permissions.id-token',
    'write'
  );
  expect(workflow).toHaveProperty(
    'jobs.deploy-prd.steps',
    expect.arrayContaining([
      expect.objectContaining({
        uses: './.github/actions/setup',
        with: expect.objectContaining({
          'secrets-environment': '${{ env.SECRETS_ENV }}',
        }),
      }),
      expect.objectContaining({
        name: 'Tag the commit and publish the release',
        if: "${{ success() && env.SECRETS_ENV == 'prd' }}",
        env: {
          GH_TOKEN: '${{ env.GITHUB_ADMIN_TOKEN }}',
          TAG: 'release-${{ github.run_number }}',
        },
        run: expect.stringContaining('--target "$GITHUB_SHA"'),
      }),
    ])
  );
});
