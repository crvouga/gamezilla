import { expect, test } from 'bun:test';
import { runVerifyPhaseGroup } from '@pkgs/quint-server/verify-phase-pool';

// regression: local-check-verifier-phase-concurrency
test('one configured solver serializes all phases without dropping a proof', async () => {
  let active = 0;
  let peak = 0;
  const attempted: number[] = [];
  const verdict = await runVerifyPhaseGroup(
    [0, 1, 2, 3],
    async (phase) => {
      attempted.push(phase);
      peak = Math.max(peak, ++active);
      await Promise.resolve();
      active--;
      return undefined;
    },
    '1'
  );
  expect(verdict).toBeUndefined();
  expect(attempted).toEqual([0, 1, 2, 3]);
  expect(peak).toBe(1);
});

test.each([undefined, '2', '4', '', 'invalid'])(
  'the existing two-phase ceiling is retained for %s',
  async (configured) => {
    let active = 0;
    let peak = 0;
    await runVerifyPhaseGroup(
      [0, 1, 2, 3],
      async () => {
        peak = Math.max(peak, ++active);
        await Promise.resolve();
        active--;
        return undefined;
      },
      configured
    );
    expect(peak).toBe(2);
  }
);

test('a failed proof retains its verdict and stops queued phases', async () => {
  const attempted: number[] = [];
  const failure = new Error('counterexample');
  expect(
    await runVerifyPhaseGroup(
      [0, 1, 2],
      async (phase) => {
        attempted.push(phase);
        return failure;
      },
      '1'
    )
  ).toBe(failure);
  expect(attempted).toEqual([0]);
});
