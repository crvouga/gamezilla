/** Non-null object that is not an array — safe for `Object.keys` / field reads. */
export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
