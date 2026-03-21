import { assert } from './assert';

/**
 * Asserts that the provided value is an instance of the given constructor.
 * Throws if the value is not an instance.
 *
 * @param value   - The value to check.
 * @param ctor    - The constructor to check against.
 * @param message - Human-readable description of the invariant.
 * @throws {{ __assertion_failure: true, message: string, context?: unknown }}
 */
export function assertInstanceOf<T>(
  value: unknown,
  ctor: new (...args: unknown[]) => T,
  message: string
): asserts value is T {
  assert(value instanceof ctor, message, { value, ctor: ctor.name });
}
