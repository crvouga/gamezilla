import { expect, test } from 'bun:test';
import { testConcurrency } from '@pkgs/os-server/test-concurrency';

test('explicit test concurrency overrides either runner default', () => {
  expect(testConcurrency({})).toBe(20);
  expect(testConcurrency({}, 2)).toBe(2);
  for (const fallback of [2, 20])
    expect(testConcurrency({ CHECK_TEST_CONCURRENCY: '1' }, fallback)).toBe(1);
  expect(testConcurrency({ CHECK_TEST_CONCURRENCY: ' 3 ' })).toBe(3);
  expect(testConcurrency({ CHECK_TEST_CONCURRENCY: ' ' }, 2)).toBe(2);
  expect(testConcurrency({ CHECK_TEST_CONCURRENCY: '8' }, 2)).toBe(2);
  for (const ceiling of [0, -1, Number.NaN])
    expect(() => testConcurrency({}, ceiling)).toThrow('positive integer');
});
