import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { ListedRunner } from './verify-runners';
import { availableRunners, matchingRunners } from './verify-runners';

const runner = (status: string, ...labels: string[]): ListedRunner => ({
  status,
  labels: labels.map((name) => ({ name })),
});

test("only online runners with the start job's OS and arch take its shards", () => {
  const runners = [
    runner('online', 'self-hosted', 'Windows', 'X64'),
    runner('online', 'self-hosted', 'Windows', 'X64'),
    runner('offline', 'self-hosted', 'Windows', 'X64'),
    runner('online', 'self-hosted', 'Linux', 'X64'),
    runner('online', 'self-hosted', 'Linux', 'ARM64'),
    runner('online', 'Windows', 'X64'),
  ];
  expect(matchingRunners(runners, 'Windows', 'X64')).toBe(2);
  expect(matchingRunners(runners, 'linux', 'x64')).toBe(1);
  expect(matchingRunners(runners, 'macOS', 'ARM64')).toBe(0);
});

test('a matching runner is counted once whatever else it is labelled', () => {
  assertProperty(
    'verify-runners-count',
    fc.property(
      fc.array(
        fc.record({
          online: fc.boolean(),
          labels: fc.subarray(['self-hosted', 'Linux', 'X64', 'gpu', 'big']),
        })
      ),
      (drawn) => {
        const runners = drawn.map(({ online, labels }) =>
          runner(online ? 'online' : 'offline', ...labels)
        );
        expect(matchingRunners(runners, 'Linux', 'X64')).toBe(
          drawn.filter(
            ({ online, labels }) =>
              online &&
              ['self-hosted', 'Linux', 'X64'].every((label) =>
                labels.includes(label)
              )
          ).length
        );
      }
    )
  );
});

test('outside a workflow, or without a listing token, the configured cap stands', () => {
  expect(availableRunners({})).toBeUndefined();
  expect(
    availableRunners({
      GITHUB_REPOSITORY: 'o/r',
      RUNNER_OS: 'Linux',
      RUNNER_ARCH: 'X64',
    })
  ).toBeUndefined();
  expect(availableRunners({ VERIFY_RUNNERS: '6' })).toBe(6);
  for (const bad of ['0', '-1', '1.5', 'many'])
    expect(() => availableRunners({ VERIFY_RUNNERS: bad })).toThrow(
      'VERIFY_RUNNERS must be a positive integer'
    );
});
