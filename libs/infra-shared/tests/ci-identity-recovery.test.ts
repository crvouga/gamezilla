import { expect, test } from 'bun:test';
import {
  ciIdentityRecoveryDenials,
  ciIdentityRecoveryEnvironment,
  ciIdentityRecoveryPlanArgs,
  validateCiIdentityRecovery,
} from '@libs/infra-shared/ci-identity-recovery';
import type { PlanJson } from '@libs/infra-shared/plan-policy';
import { STACKS } from '@libs/infra-shared/tofu-command';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const PATHS = { tofuDir: '/tofu', cacheDir: '/cache' };
const SECRETS = {
  TOFU_STATE_PASSPHRASE: 'pass',
  TOFU_STATE_ACCESS_KEY_ID: 'state-id',
  TOFU_STATE_SECRET_ACCESS_KEY: 'state-secret',
};

function plan(address: string, actions: readonly string[]): PlanJson {
  return {
    resource_changes: [
      {
        address,
        mode: 'managed',
        type: 'infisical_identity_oidc_auth',
        change: { actions },
      },
    ],
  };
}

test('an existing CI identity can be recovered without an AWS login', () => {
  // regression: ci-identity-recovery-requires-aws-session
  const { env, missing } = ciIdentityRecoveryEnvironment(SECRETS, PATHS);
  expect(missing).toEqual([]);
  expect(env['AWS_ACCESS_KEY_ID']).toBe('state-id');
  expect(env['AWS_SECRET_ACCESS_KEY']).toBe('state-secret');
  expect(env['TF_VAR_state_passphrase']).toBe('pass');
  expect(env['TF_VAR_aws_access_key_id']).toBeUndefined();
  expect(env['TF_VAR_aws_secret_access_key']).toBeUndefined();
  const args = ciIdentityRecoveryPlanArgs(PATHS);
  expect(args).toContain('-chdir=/tofu/stacks/bootstrap');
  expect(args).toContain('-target=module.ci_identity');
  expect(args).toContain('-out=/cache/bootstrap-global.tfplan');
  expect(
    ciIdentityRecoveryDenials(
      plan('module.ci_identity.infisical_identity_oidc_auth.ci', ['update'])
    )
  ).toEqual([]);
});

test('recovery requires every state credential and ignores account credentials', () => {
  assertProperty(
    'state credentials cannot silently fall back',
    fc.property(
      fc.subarray(Object.keys(SECRETS)),
      fc.string(),
      (keys, accountKey) => {
        const secrets = Object.fromEntries(
          keys.map((key) => [key, SECRETS[key as keyof typeof SECRETS]])
        );
        const { env, missing } = ciIdentityRecoveryEnvironment(
          {
            ...secrets,
            AWS_ACCOUNT_ACCESS_KEY_ID: accountKey,
            AWS_ACCOUNT_SECRET_ACCESS_KEY: accountKey,
          },
          PATHS
        );
        expect([...missing].sort()).toEqual(
          Object.keys(SECRETS)
            .filter((key) => !keys.includes(key))
            .sort()
        );
        expect(env['TF_VAR_aws_access_key_id']).toBeUndefined();
      }
    )
  );
});

test('recovery cannot create, replace, delete or forget an identity', () => {
  assertProperty(
    'only in-place repairs are permitted',
    fc.property(
      fc.constantFrom(
        ['create'],
        ['delete'],
        ['forget'],
        ['delete', 'create'],
        ['create', 'delete']
      ),
      (actions) => {
        expect(
          ciIdentityRecoveryDenials(
            plan('module.ci_identity.infisical_identity_oidc_auth.ci', actions)
          )
        ).toHaveLength(1);
      }
    )
  );
});

test('recovery refuses modifications outside the CI identity', () => {
  assertProperty(
    'the rest of bootstrap is outside the repair scope',
    fc.property(
      fc.constantFrom(
        'module.aws_ci.aws_iam_role.deploy',
        'module.repository.github_repository.this',
        'module.state.cloudflare_r2_bucket.this'
      ),
      fc.constantFrom(['update'], ['create'], ['delete'], ['forget']),
      (address, actions) =>
        expect(ciIdentityRecoveryDenials(plan(address, actions))).toHaveLength(
          1
        )
    )
  );
  expect(
    ciIdentityRecoveryDenials(
      plan('module.state.cloudflare_r2_bucket.this', ['no-op'])
    )
  ).toEqual([]);
});

test('recovery accepts only a bootstrap plan or apply', () => {
  for (const stack of STACKS) {
    for (const command of ['plan', 'apply', 'destroy', 'drift']) {
      const validate = () => validateCiIdentityRecovery(command, stack);
      if (stack === 'bootstrap' && ['plan', 'apply'].includes(command))
        expect(validate).not.toThrow();
      else expect(validate).toThrow('--recover-ci-identity requires');
    }
  }
});
