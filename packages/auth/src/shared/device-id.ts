/**
 * Auth-semantic wrapper around the generic UUID utilities from `@gamezilla/lib`.
 * `deviceId` is always a v4 UUID so most call sites just need the assertion
 * form; the underlying utilities are re-exported for backwards compatibility
 * with existing import sites inside the auth package.
 */
export { UUID_REGEX, assertUuid, isUuid } from '@gamezilla/lib/uuid';
import { assertUuid } from '@gamezilla/lib/uuid';

/**
 * Asserts deviceId is a valid UUID. Crashes on violation.
 */
export function assertDeviceId(value: unknown): asserts value is string {
  assertUuid(value, 'deviceId must be a valid UUID');
}
