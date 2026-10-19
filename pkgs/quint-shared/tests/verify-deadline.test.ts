import { afterEach, expect, test } from 'bun:test';
import { verifyDeadlineMs } from '@pkgs/quint-shared/wall';

const ENV = 'QUINT_VERIFY_TIME_SCALE';
const before = process.env[ENV];

afterEach(() => {
  if (before === undefined) delete process.env[ENV];
  else process.env[ENV] = before;
});

// regression: proof-deadline-ignores-slow-runner
test('a proof keeps its declared deadline unless the runner names a slowdown', () => {
  delete process.env[ENV];
  expect(verifyDeadlineMs(240_000)).toBe(240_000);
  process.env[ENV] = '';
  expect(verifyDeadlineMs(240_000)).toBe(240_000);
  // Verify run 38190147513: `username-changes.qnt` takes 133 s on a laptop
  // and had no verdict within its 240 s on the 2-core runner.
  process.env[ENV] = '2';
  expect(verifyDeadlineMs(240_000)).toBe(480_000);
  expect(verifyDeadlineMs(120_000)).toBe(240_000);
});

test('a runner cannot shorten a deadline or name a slowdown that is not a number', () => {
  for (const scale of ['0.5', '0', '-2', 'fast', 'NaN', 'Infinity']) {
    process.env[ENV] = scale;
    expect(() => verifyDeadlineMs(240_000)).toThrow('QUINT_VERIFY_TIME_SCALE');
  }
});
