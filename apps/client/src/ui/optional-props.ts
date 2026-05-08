/**
 * Build a partial-prop object that omits keys whose value is `undefined`.
 * Useful when forwarding optional props to a component whose prop type uses
 * `exactOptionalPropertyTypes` (which rejects `prop={undefined}`).
 *
 * @example
 *   <Text {...optionalProps({ variant, sx, numberOfLines })} label={label} />
 */
export function optionalProps<T extends Record<string, unknown>>(
  values: T
): Partial<T> {
  const out: Partial<T> = {};
  for (const key in values) {
    const v = values[key];
    if (v !== undefined) {
      out[key] = v;
    }
  }
  return out;
}
