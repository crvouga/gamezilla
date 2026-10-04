/**
 * Internal testId handle for query adapters that still prefer an object.
 * Public Driver APIs take plain `string` test ids — do not re-export multi-kind
 * selectors (`text` / `role` / `label`) from the package surface.
 */
export type TestIdSelector = {
  readonly kind: 'testId';
  readonly value: string;
};

/** Build a testId selector object for internal query helpers. */
export function testIdSelector(value: string): TestIdSelector {
  return { kind: 'testId', value };
}
