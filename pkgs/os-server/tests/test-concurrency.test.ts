import { expect, test } from 'bun:test';
import {
  specParallelism,
  specWorkerCeiling,
  testConcurrency,
} from '@pkgs/os-server/test-concurrency';

const GIB = 1024 * 1024 * 1024;

test('spec workers scale with CPUs and RAM and never pass the cap', () => {
  expect(specWorkerCeiling(12, 32 * GIB)).toBe(10);
  expect(specWorkerCeiling(64, 256 * GIB)).toBe(16);
  expect(specWorkerCeiling(8, 16 * GIB)).toBe(4);
  expect(specWorkerCeiling(4, 16 * GIB)).toBe(2);
  expect(specWorkerCeiling(2, 8 * GIB)).toBe(1);
  expect(specParallelism({ CHECK_TEST_CONCURRENCY: '1' })).toBe(1);
  expect(specParallelism({})).toBeGreaterThan(0);
  for (const cpus of [0, -1])
    expect(() => specWorkerCeiling(cpus, 32 * GIB)).toThrow('positive integer');
});

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
