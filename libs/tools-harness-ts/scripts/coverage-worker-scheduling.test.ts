import { expect, test } from 'bun:test';
import { parseOptions } from './verify-coverage';

// regression: coverage-worker-contention
test('coverage serializes instrumented suites unless concurrency is explicitly chosen', () => {
  expect(parseOptions([]).jobs).toBe(1);
  expect(parseOptions(['--jobs=2']).jobs).toBe(2);
  expect(parseOptions(['--jobs', '3']).jobs).toBe(3);
});
