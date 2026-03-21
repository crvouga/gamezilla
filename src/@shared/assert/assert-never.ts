import { assert } from './assert';

/**
 * Asserts that a value is never possible.
 *
 * Use to enforce exhaustiveness in switch statements or union type handling.
 * Will trigger an assertion failure if called at runtime, indicating unhandled case.
 *
 * @param value - The value that should be of `never` type.
 * @throws {{ __assertion_failure: true, message: string, context?: unknown }}
 * @example
 *   switch (kind) {
 *     case 'foo': ...
 *     case 'bar': ...
 *     default: assertNever(kind);
 *   }
 */
export function assertNever(value: never): never {
  assert(false, 'Unhandled value', { value });
}
