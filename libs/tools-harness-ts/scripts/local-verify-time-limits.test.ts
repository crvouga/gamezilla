import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { verifyDeadlineMs } from '@pkgs/quint-shared-ts/wall';
import fc from 'fast-check';
import { localVerifyEnv } from './local-verify-queue';
import { findBudgetOverruns, resolveRunDeadlineSeconds } from './verify-budget';

// regression: local-verify-time-limits-stop-complete-proofs
test('local verification can finish after the observed run and model deadlines', () => {
  const env = localVerifyEnv({});
  expect(env['VERIFY_TIME_LIMITS']).toBe('off');
  expect(
    resolveRunDeadlineSeconds(env, { isDeploy: false, slowRunner: false })
  ).toBe(Number.POSITIVE_INFINITY);
  expect(verifyDeadlineMs(240_000, env)).toBe(Number.POSITIVE_INFINITY);
  expect(
    findBudgetOverruns(
      {
        tasks: [
          {
            taskId: '@libs/games-harness-ts#verify:models:2',
            execution: { startTime: 0, endTime: 645_400 },
          },
        ],
      },
      false,
      env
    )
  ).toEqual([]);
});

test('local run and proof allowances do not cap computation duration', async () => {
  await assertProperty(
    'local-verify-unlimited-computation',
    fc.asyncProperty(fc.integer({ min: 1, max: 86_400 }), async (seconds) => {
      expect(verifyDeadlineMs(seconds * 1000, localVerifyEnv({}))).toBe(
        Number.POSITIVE_INFINITY
      );
      expect(
        resolveRunDeadlineSeconds(
          localVerifyEnv({ VERIFY_DEADLINE_SECONDS: String(seconds) }),
          { isDeploy: false, slowRunner: false }
        )
      ).toBe(Number.POSITIVE_INFINITY);
    })
  );
});

test('bounded verification remains available explicitly and to ordinary runners', () => {
  const options = { isDeploy: false, slowRunner: false };
  expect(resolveRunDeadlineSeconds({}, options)).toBe(600);
  expect(verifyDeadlineMs(240_000, {})).toBe(240_000);
  const bounded = localVerifyEnv({ VERIFY_TIME_LIMITS: 'on' });
  expect(resolveRunDeadlineSeconds(bounded, options)).toBe(600);
  expect(verifyDeadlineMs(240_000, bounded)).toBe(240_000);
});
