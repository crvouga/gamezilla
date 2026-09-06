/**
 * DOM component identifiers for react-native-web.
 *
 * On web, `dataSet` maps to `data-*` attributes via RNW's `createDOMProps`.
 * Active in development and E2E preview builds; dead-code-eliminated from
 * production so the attributes never ship to end users.
 *
 * Merge rule: the outer call site wins. Each component contributes
 * `{ component: name }` as a default, then spreads `incoming` over it so a
 * parent (or the Babel `data-src` injector) can override.
 */

/** Keys become `data-<key>` attributes on the host DOM node. */
export type ComponentDataSet = Record<string, string>;

/**
 * Metro inlines `process.env.NODE_ENV` and `EXPO_PUBLIC_*` at bundle time, so
 * this constant folds to `false` in production (unless `EXPO_PUBLIC_E2E=1`).
 */
export const COMPONENT_IDS_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env['EXPO_PUBLIC_E2E'] === '1';

/**
 * Returns a props fragment `{ dataSet }` with `component: name` merged under
 * any incoming keys. Returns `{}` when identifiers are disabled so callers
 * can safely spread the result.
 */
export function componentDataSet(
  name: string,
  incoming: ComponentDataSet | undefined
): { dataSet?: ComponentDataSet } {
  if (!COMPONENT_IDS_ENABLED) return {};
  return { dataSet: { component: name, ...incoming } };
}
