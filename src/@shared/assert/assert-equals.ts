import { assert } from './assert';

export function assertEquals(
  actual: unknown,
  expected: unknown,
  message: string,
  context?: Record<string, unknown>
): asserts actual is unknown {
  assert(actual === expected, message, context);
}
