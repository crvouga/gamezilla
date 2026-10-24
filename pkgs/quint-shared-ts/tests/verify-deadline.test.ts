import { expect, test } from 'bun:test';
import { verifyDeadlineMs } from '@pkgs/quint-shared-ts/wall';

// regression: proof-deadline-ignores-slow-runner
test('a proof keeps its declared deadline unless the runner names a slowdown', () => {
  expect(verifyDeadlineMs(240_000, {})).toBe(240_000);
  expect(verifyDeadlineMs(240_000, { QUINT_VERIFY_TIME_SCALE: '' })).toBe(
    240_000
  );
  // Verify run 38190147513: `username-changes.qnt` takes 133 s on a laptop
  // and had no verdict within its 240 s on the 2-core runner.
  const runner = { QUINT_VERIFY_TIME_SCALE: '2' };
  expect(verifyDeadlineMs(240_000, runner)).toBe(480_000);
  expect(verifyDeadlineMs(120_000, runner)).toBe(240_000);
});

test('a runner cannot shorten a deadline or name a slowdown that is not a number', () => {
  for (const scale of ['0.5', '0', '-2', 'fast', 'NaN', 'Infinity']) {
    expect(() =>
      verifyDeadlineMs(240_000, { QUINT_VERIFY_TIME_SCALE: scale })
    ).toThrow('QUINT_VERIFY_TIME_SCALE');
  }
});
