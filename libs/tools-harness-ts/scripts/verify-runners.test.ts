import { expect, test } from 'bun:test';
import { availableRunners } from './verify-runners';

test('without VERIFY_RUNNERS the configured cap stands', () => {
  expect(availableRunners({})).toBeUndefined();
  expect(availableRunners({ VERIFY_RUNNERS: ' ' })).toBeUndefined();
  expect(
    availableRunners({
      GITHUB_REPOSITORY: 'o/r',
      RUNNER_OS: 'Linux',
      RUNNER_ARCH: 'X64',
    })
  ).toBeUndefined();
});

test('VERIFY_RUNNERS is a positive integer', () => {
  expect(availableRunners({ VERIFY_RUNNERS: '6' })).toBe(6);
  expect(availableRunners({ VERIFY_RUNNERS: ' 16 ' })).toBe(16);
  for (const bad of ['0', '-1', '1.5', 'many'])
    expect(() => availableRunners({ VERIFY_RUNNERS: bad })).toThrow(
      'VERIFY_RUNNERS must be a positive integer'
    );
});
