import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  type PrCheck,
  type RequiredPrCheck,
  requiredPrCheckFailures,
} from './required-pr-checks';

const directory = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/repository/required-checks'
);
const REQUIRED = readdirSync(directory).map(
  (file) =>
    JSON.parse(readFileSync(join(directory, file), 'utf8')) as RequiredPrCheck
);
const START: PrCheck = {
  name: 'verify:start',
  appId: 15368,
  status: 'completed',
  conclusion: 'success',
};
const END: PrCheck = {
  name: 'verify:end',
  appId: 15368,
  status: 'in_progress',
  conclusion: null,
};
const SECURITY: PrCheck = {
  name: 'GitGuardian Security Checks',
  appId: 46505,
  status: 'completed',
  conclusion: 'success',
};
const PASSED: readonly PrCheck[] = REQUIRED.map((policy) => ({
  name: policy.context,
  appId: policy.integration_id,
  status: policy.context === 'verify:end' ? 'in_progress' : 'completed',
  conclusion: policy.context === 'verify:end' ? null : 'success',
}));
const withSecurity = (check: PrCheck): readonly PrCheck[] =>
  PASSED.map((original) =>
    original.name === SECURITY.name ? check : original
  );

test('every declared check passes while the current final verdict is still executing', () => {
  expect(requiredPrCheckFailures(REQUIRED, PASSED, false)).toEqual([]);
});

// regression: optional-pr-checks
test('a successful optional integration still fails the PR gate until it is required', () => {
  const optional = { ...SECURITY, name: 'New security scanner', appId: 123 };
  expect(
    requiredPrCheckFailures(REQUIRED, [...PASSED, optional], false)
  ).toEqual([
    'Optional or untrusted check: New security scanner (app 123); declare it in the repository required-checks registry',
  ]);
});

test('a missing check, an impersonated app and an advisory legacy status all fail closed', () => {
  expect(
    requiredPrCheckFailures(REQUIRED, [START, END], false).join()
  ).toContain('Missing required check: GitGuardian');
  for (const appId of [0, 15368]) {
    const errors = requiredPrCheckFailures(
      REQUIRED,
      withSecurity({ ...SECURITY, appId }),
      false
    );
    expect(
      errors.some((error) => error.includes('Missing required check'))
    ).toBe(true);
    expect(errors.some((error) => error.includes('untrusted check'))).toBe(
      true
    );
  }
});

test('every scheduled shard must pass; only an empty plan permits its unexpanded skipped job', () => {
  const shard = { ...START, name: 'verify:shards (0)' };
  expect(requiredPrCheckFailures(REQUIRED, [...PASSED, shard], false)).toEqual(
    []
  );
  expect(
    requiredPrCheckFailures(
      REQUIRED,
      [...PASSED, { ...shard, conclusion: 'failure' }],
      false
    )
  ).not.toEqual([]);
  const skipped = { ...shard, name: 'verify:shards', conclusion: 'skipped' };
  expect(
    requiredPrCheckFailures(REQUIRED, [...PASSED, skipped], false)
  ).not.toEqual([]);
  expect(requiredPrCheckFailures(REQUIRED, [...PASSED, skipped], true)).toEqual(
    []
  );
  expect(
    requiredPrCheckFailures(
      REQUIRED,
      [...PASSED, { ...shard, conclusion: 'skipped' }],
      true
    )
  ).not.toEqual([]);
});

test('no non-success conclusion can satisfy a declared integration', () => {
  assertProperty(
    'every declared non-success outcome blocks merging',
    fc.property(
      fc.constantFrom(
        'failure',
        'neutral',
        'cancelled',
        'skipped',
        'timed_out',
        'action_required',
        'stale',
        'startup_failure',
        null
      ),
      fc.constantFrom('queued', 'in_progress', 'completed'),
      (conclusion, status) => {
        expect(
          requiredPrCheckFailures(
            REQUIRED,
            withSecurity({ ...SECURITY, status, conclusion }),
            false
          )
        ).not.toEqual([]);
      }
    )
  );
});

test('every PR invokes the guard after the suite verdict with failures enforced', () => {
  const path = join(
    import.meta.dirname,
    '../../../.github/workflows/verify-pr.yml'
  );
  const workflow = Bun.YAML.parse(readFileSync(path, 'utf8')) as {
    jobs: Record<
      string,
      {
        'continue-on-error'?: boolean;
        steps: {
          name?: string;
          if?: string;
          run?: string;
          'continue-on-error'?: boolean;
        }[];
      }
    >;
  };
  expect(
    Object.values(workflow.jobs).some((job) => job['continue-on-error'])
  ).toBe(false);
  const steps = workflow.jobs['verify-end']!.steps;
  const verdict = steps.findIndex((step) =>
    step.run?.includes('scripts/verify-verdict.ts')
  );
  const guard = steps.findIndex((step) =>
    step.run?.includes('@libs/tools-harness-ts#verify:pr-checks')
  );
  expect(guard).toBeGreaterThan(verdict);
  expect(steps[guard]?.if).toBe(
    "always() && !cancelled() && github.event_name == 'pull_request'"
  );
  expect(steps[guard]?.['continue-on-error']).toBeUndefined();
});
