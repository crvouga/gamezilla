import { assert } from './assert';

/**
 * Asserts that the provided value is an array.
 * Throws if the value is not an array.
 *
 * @param value   - The value to check.
 * @param message - Human-readable description of the invariant.
 * @throws {{ __assertion_failure: true, message: string, context?: unknown }}
 */
export function assertArray(
  value: unknown,
  message: string
): asserts value is unknown[] {
  assert(Array.isArray(value), message, { value });
}
