import { expect, test } from 'bun:test';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';
import {
  repositoryPolicyDenials,
  repositoryPolicyEnvironment,
  repositoryPolicyPlanArgs,
  validateRepositoryPolicy,
} from '@libs/infra-shared-ts/repository-policy';

const paths = { tofuDir: '/tofu', cacheDir: '/cache' };

function plan(address: string, actions: readonly string[]): PlanJson {
  return {
    resource_changes: [
      {
        address,
        mode: 'managed',
        type: 'github_repository',
        change: { actions },
      },
    ],
  };
}

test('CI repository policy needs only administration and encrypted state credentials', () => {
  const { env, missing } = repositoryPolicyEnvironment(
    {
      GITHUB_ADMIN_TOKEN: 'admin',
      TOFU_STATE_PASSPHRASE: 'pass',
      TOFU_STATE_ACCESS_KEY_ID: 'state',
      TOFU_STATE_SECRET_ACCESS_KEY: 'secret',
    },
    paths
  );
  expect(missing).toEqual([]);
  expect(env['GITHUB_TOKEN']).toBe('admin');
  expect(env['TF_VAR_aws_access_key_id']).toBeUndefined();
  expect(env['CLOUDFLARE_API_TOKEN']).toBeUndefined();
  expect(repositoryPolicyEnvironment({}, paths).missing).toHaveLength(4);
  const args = repositoryPolicyPlanArgs(paths);
  expect(args).toContain(
    '-target=module.repository.github_repository_ruleset.main'
  );
  expect(args.some((arg) => arg.includes('github_actions_variable'))).toBe(
    false
  );
});

test('saved plans cannot escape the repository scope or destroy configuration', () => {
  for (const actions of [['delete'], ['delete', 'create'], ['forget']])
    expect(
      repositoryPolicyDenials(
        plan('module.repository.github_repository.this', actions)
      )
    ).toHaveLength(1);
  for (const address of [
    'module.aws_ci.aws_iam_role.deploy',
    'module.repository.github_actions_variable.this["AWS_ROLE_ARN"]',
    'module.repository.github_repository.this_other',
  ])
    expect(repositoryPolicyDenials(plan(address, ['update']))).toHaveLength(1);
  for (const actions of [['create'], ['update'], ['no-op']])
    expect(
      repositoryPolicyDenials(
        plan('module.repository.github_repository.this', actions)
      )
    ).toEqual([]);
  expect(
    repositoryPolicyDenials(plan('module.state.bucket', ['no-op']))
  ).toEqual([]);
});

test('repository policy cannot destroy or bootstrap another stack', () => {
  for (const command of ['plan', 'apply', 'drift'])
    expect(() => validateRepositoryPolicy(command, 'bootstrap')).not.toThrow();
  expect(() => validateRepositoryPolicy('destroy', 'bootstrap')).toThrow();
  expect(() => validateRepositoryPolicy('apply', 'fleet')).toThrow();
});
