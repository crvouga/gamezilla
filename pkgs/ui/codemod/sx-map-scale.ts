/**
 * Scaled (4px-grid) spacing props: `p/px/py/…`, `m/mx/my/…`, `gap/rowGap/columnGap`.
 *
 * `p: 4` means 16px (`resolveSpacing`: lookup table, else `n * 4` — every
 * table entry equals `n * 4`, so both paths agree). Tailwind v4 derives
 * spacing utilities from `--spacing: 0.25rem`, so `p-4` is exactly 16px and
 * the same-number utility is byte-equivalent for any multiple of 0.25.
 */

import type { DynamicStyle, StaticMapping } from './mapping-types';
import { invariant } from './tiger';

/** Format a px number exactly like `sx-to-css` (`0` stays `0`). */
export function px(n: number): string {
  invariant(Number.isFinite(n), `px() got non-finite ${String(n)}`);
  return n === 0 ? '0' : `${n}px`;
}

/** True when Tailwind v4 accepts the number as a bare spacing value. */
export function isBareSpacingValue(n: number): boolean {
  return Number.isFinite(n) && Math.round(n * 4) === n * 4;
}

/** Guarantee dash-case CSS keys for dynamic style splices. */
export function dashCase(prop: string): string {
  if (prop.startsWith('-') || prop.includes('-')) return prop;
  return prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

const SCALED_PREFIX: Readonly<Record<string, string>> = {
  p: 'p',
  px: 'px',
  py: 'py',
  pt: 'pt',
  pb: 'pb',
  pl: 'pl',
  pr: 'pr',
  m: 'm',
  mx: 'mx',
  my: 'my',
  mt: 'mt',
  mb: 'mb',
  ml: 'ml',
  mr: 'mr',
  gap: 'gap',
  rowGap: 'gap-y',
  columnGap: 'gap-x',
};

/** CSS properties each scaled prop writes (mirrors `sx-to-css`). */
export const SCALED_DECLARATIONS: Readonly<Record<string, readonly string[]>> =
  {
    p: ['padding'],
    px: ['padding-left', 'padding-right'],
    py: ['padding-top', 'padding-bottom'],
    pt: ['padding-top'],
    pb: ['padding-bottom'],
    pl: ['padding-left'],
    pr: ['padding-right'],
    m: ['margin'],
    mx: ['margin-left', 'margin-right'],
    my: ['margin-top', 'margin-bottom'],
    mt: ['margin-top'],
    mb: ['margin-bottom'],
    ml: ['margin-left'],
    mr: ['margin-right'],
    gap: ['gap'],
    rowGap: ['row-gap'],
    columnGap: ['column-gap'],
  };

export function isScaledProp(prop: string): boolean {
  return prop in SCALED_PREFIX;
}

/** Map a static scaled value. Non-numbers are ignored by the runtime. */
export function mapScaledStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { kind: 'omit' };
  }
  const prefix = SCALED_PREFIX[prop] ?? prop;
  const decls = SCALED_DECLARATIONS[prop] ?? [];
  const pxValue = px(value * 4);
  if (value >= 0 && isBareSpacingValue(value)) {
    return { kind: 'classes', classes: [`${prefix}-${value}`] };
  }
  if (decls.length === 1) {
    return { kind: 'classes', classes: [`${prefix}-[${pxValue}]`] };
  }
  return {
    kind: 'classes',
    classes: [`[${decls.map((d) => `${d}:${pxValue}`).join(';')}]`],
  };
}

/** Dynamic scaled values stay exact via `` `${(e) * 4}px` `` (pairs fan out). */
export function mapScaledDynamic(prop: string): DynamicStyle {
  const decls = SCALED_DECLARATIONS[prop] ?? [];
  if (decls.length > 0) {
    return { kind: 'style', cssProps: decls, wrap: 'scaled' };
  }
  return { kind: 'bail', reason: `${prop} has no declarations` };
}
