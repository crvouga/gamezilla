/**
 * DOM component identifiers.
 *
 * Every host renders `data-component="<Name>"` in development and E2E builds
 * so the inspector and browser E2E drivers can locate design-system nodes.
 * `import.meta.env.DEV` folds to `false` in production, so the attributes
 * never ship to end users unless `VITE_E2E=1`.
 *
 * Merge rule: the outer call site wins. Each component contributes
 * `{ component: name }` as a default, then spreads `incoming` over it so a
 * parent can override.
 */

/** Keys become `data-<key>` attributes on the host DOM node. */
export type ComponentDataSet = Record<string, string>;

export type ComponentDataAttrs = Record<`data-${string}`, string>;

const env = import.meta.env as { DEV?: boolean; VITE_E2E?: string };

export const COMPONENT_IDS_ENABLED: boolean =
  env.DEV === true || env.VITE_E2E === '1';

/**
 * `data-*` attribute fragment with `component: name` merged under any
 * incoming keys. Returns `{}` when identifiers are disabled so callers can
 * safely spread the result.
 *
 * For design-system hosts only. Migrated plain elements use {@link dataAttrs}
 * so they do not get a synthetic `data-component`.
 */
export function componentDataAttrs(
  name: string,
  incoming: ComponentDataSet | undefined
): ComponentDataAttrs {
  if (!COMPONENT_IDS_ENABLED) return {};
  const out: ComponentDataAttrs = { 'data-component': name };
  if (incoming !== undefined) {
    for (const [key, value] of Object.entries(incoming)) {
      out[`data-${key}`] = value;
    }
  }
  return out;
}

/**
 * Map a `dataSet` bag to `data-*` attrs without injecting `data-component`.
 * Used by the sx→Tailwind migration for plain HTML hosts.
 */
export function dataAttrs(
  incoming: ComponentDataSet | undefined
): ComponentDataAttrs {
  if (incoming === undefined) return {};
  const out: ComponentDataAttrs = {};
  for (const [key, value] of Object.entries(incoming)) {
    out[`data-${key}`] = value;
  }
  return out;
}
