import { expect, spyOn, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  verificationTimeLimitsEnabled,
  verifyDeadlineMs,
  wallDeadline,
} from '@pkgs/quint-shared-ts/wall';
import fc from 'fast-check';

// regression: local-verify-time-limits-stop-complete-proofs
test('an unlimited deadline never overflows into an immediate cancellation', () => {
  const scheduled = spyOn(globalThis, 'setTimeout');
  try {
    const cancel = wallDeadline(Number.POSITIVE_INFINITY, () => {
      throw new Error('unlimited proof cancelled');
    });
    cancel();
    expect(scheduled).not.toHaveBeenCalled();
  } finally {
    scheduled.mockRestore();
  }
});

test('unlimited computation ignores time allowances while bounded proofs retain them', async () => {
  await assertProperty(
    'unlimited-proof-deadline',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 2_000_000_000 }),
      async (declaredMs) => {
        expect(
          verifyDeadlineMs(declaredMs, { VERIFY_TIME_LIMITS: 'off' })
        ).toBe(Number.POSITIVE_INFINITY);
        expect(verifyDeadlineMs(declaredMs, { VERIFY_TIME_LIMITS: 'on' })).toBe(
          declaredMs
        );
      }
    )
  );
});

test('invalid limit configuration fails instead of silently removing a deadline', () => {
  for (const mode of ['0', 'false', 'unlimited', 'typo'])
    expect(() =>
      verificationTimeLimitsEnabled({ VERIFY_TIME_LIMITS: mode })
    ).toThrow('must be on or off');
});
