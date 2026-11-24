/**
 * The attribute value of an optional true/false ARIA state: `"true"` or
 * `"false"` when the state is known, `undefined` (no attribute) when it is
 * not. A bare boolean on an element means presence, which ARIA does not read.
 */
export function ariaBoolean(
  value: boolean | undefined
): 'true' | 'false' | undefined {
  if (value === undefined) return undefined;
  return value ? 'true' : 'false';
}
