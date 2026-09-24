import { assert } from '@pkgs/assert/singleton';

/** RFC 9562 UUID pattern, including time-ordered UUIDv7. */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Asserts value is a valid UUID string at trust boundaries. Crashes on violation.
 */
export function assertUuid(
  value: unknown,
  message: string
): asserts value is string {
  assert.string(value, message);
  assert.ok(UUID_REGEX.test(value), message, { value });
}
