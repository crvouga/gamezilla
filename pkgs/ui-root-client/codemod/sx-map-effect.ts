/**
 * Radius, elevation, shadow, transform, pointer events, animation/transition,
 * line clamp, grid, scroll snap, filters, and absolute fill.
 *
 * Exactness notes:
 * - Named radii resolve through `borderRadius` (`sm` → 6px, NOT Tailwind's
 *   `rounded-sm` = 4px), so every radius maps to an arbitrary value except
 *   `none` → `rounded-none`.
 * - `elevation` maps to `bg-elevation-N`, backed by
 *   `@theme --color-elevation-N: var(--ui-elevation-N)` in this codemod's
 *   `theme.css` (dark-only lift, transparent in light — identical).
 * - Static `transform` lists compile with the same px rules as `sx-to-css`
 *   into one `[transform:…]` arbitrary property (order preserved).
 * - `box-only` emits nothing at runtime → omitted (exact).
 */

import { borderRadius } from '@pkgs/ui-root-shared/scale';
import type { DynamicStyle, StaticMapping } from './mapping-types';
import { dashCase, px } from './sx-map-scale';

const RADIUS_SIDE: Readonly<Record<string, string>> = {
  borderRadius: 'rounded',
  borderTopLeftRadius: 'rounded-tl',
  borderTopRightRadius: 'rounded-tr',
  borderBottomLeftRadius: 'rounded-bl',
  borderBottomRightRadius: 'rounded-br',
};

export function isRadiusProp(prop: string): boolean {
  return prop in RADIUS_SIDE;
}

export function mapRadiusStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const prefix = RADIUS_SIDE[prop] ?? 'rounded';
  const none = prop === 'borderRadius' ? 'rounded-none' : `${prefix}-none`;
  if (value === 'none') return { kind: 'classes', classes: [none] };
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 0) return { kind: 'classes', classes: [none] };
    return { kind: 'classes', classes: [`${prefix}-[${px(value)}]`] };
  }
  if (typeof value === 'string' && value in borderRadius) {
    const n = borderRadius[value as keyof typeof borderRadius];
    if (n === 0) return { kind: 'classes', classes: [none] };
    return { kind: 'classes', classes: [`${prefix}-[${px(n)}]`] };
  }
  return { kind: 'bail', reason: `${prop} ${String(value)} is not static` };
}

export function mapElevationStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return { kind: 'classes', classes: [`bg-elevation-${value}`] };
  }
  if (value === 0) return { kind: 'omit' };
  return { kind: 'bail', reason: `elevation ${String(value)} is not static` };
}

export function mapBoxShadowStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'string') {
    return {
      kind: 'classes',
      classes: [`[box-shadow:${value.replace(/ /g, '_')}]`],
    };
  }
  return { kind: 'bail', reason: 'boxShadow is not a static string' };
}

const TRANSFORM_PX_KEYS = new Set(['translateX', 'translateY', 'perspective']);

function transformPiece(key: string, value: string | number): string {
  if (typeof value === 'number' && TRANSFORM_PX_KEYS.has(key)) {
    return `${key}(${px(value)})`;
  }
  return `${key}(${value})`;
}

/** Compile one static transform entry (mirrors `sx-to-css`). */
export function compileStaticTransform(
  entries: readonly { key: string; value: string | number }[]
): string | undefined {
  const parts: string[] = [];
  for (const entry of entries) {
    parts.push(transformPiece(entry.key, entry.value));
  }
  if (parts.length === 0) return undefined;
  return `[transform:${parts.join(' ').replace(/ /g, '_')}]`;
}

export function mapPointerEventsStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (value === 'none' || value === 'box-none') {
    return { kind: 'classes', classes: ['pointer-events-none'] };
  }
  if (value === 'auto') {
    return { kind: 'classes', classes: ['pointer-events-auto'] };
  }
  if (value === 'box-only') return { kind: 'omit' };
  return { kind: 'bail', reason: 'pointerEvents is not static' };
}

export function mapLineClampStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return { kind: 'classes', classes: [`line-clamp-${value}`] };
  }
  return { kind: 'bail', reason: 'lineClamp is not a static integer' };
}

const GRID_UTILITY: Readonly<Record<string, string>> = {
  gridTemplateColumns: 'grid-cols',
  gridTemplateRows: 'grid-rows',
  gridColumn: 'col',
  gridRow: 'row',
};

export function isGridProp(prop: string): boolean {
  return prop in GRID_UTILITY;
}

export function mapGridStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value !== 'string') {
    return { kind: 'bail', reason: `${prop} is not a static string` };
  }
  const prefix = GRID_UTILITY[prop] ?? 'grid-cols';
  return {
    kind: 'classes',
    classes: [`${prefix}-[${value.replace(/ /g, '_')}]`],
  };
}

const ARBITRARY_PROP: Readonly<Record<string, string>> = {
  transformOrigin: 'transform-origin',
  animationName: 'animation-name',
  animationDuration: 'animation-duration',
  animationDelay: 'animation-delay',
  transitionProperty: 'transition-property',
  transitionDuration: 'transition-duration',
  transitionTimingFunction: 'transition-timing-function',
  transitionDelay: 'transition-delay',
  backdropFilter: 'backdrop-filter',
  willChange: 'will-change',
  scrollSnapType: 'scroll-snap-type',
  scrollSnapAlign: 'scroll-snap-align',
  animationIterationCount: 'animation-iteration-count',
  fontFamily: 'font-family',
};

export function isArbitraryProp(prop: string): boolean {
  return prop in ARBITRARY_PROP;
}

/** Mirror `quoteCssFontFamily`: quote non-alphanumeric stacks, join tight. */
function canonicalFontFamily(value: string): string | undefined {
  const parts = value.split(',');
  const quoted: string[] = [];
  for (const part of parts) {
    const name = part.trim();
    if (name === '') return undefined;
    quoted.push(/^[A-Za-z0-9-]+$/.test(name) ? name : `"${name}"`);
  }
  return quoted.join(',').replace(/ /g, '_');
}

export function mapArbitraryStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const css = ARBITRARY_PROP[prop] ?? prop;
  if (typeof value === 'string') {
    if (prop === 'fontFamily' && value.includes('"')) {
      return { kind: 'bail', reason: 'fontFamily quoting is not reversible' };
    }
    if (prop === 'fontFamily' && value.includes('_')) {
      return {
        kind: 'bail',
        reason: 'fontFamily underscores collide with escaping',
      };
    }
    const canonical =
      prop === 'fontFamily'
        ? canonicalFontFamily(value)
        : value.replace(/ /g, '_');
    if (canonical === undefined) {
      return { kind: 'bail', reason: 'fontFamily quoting is not reversible' };
    }
    return { kind: 'classes', classes: [`[${css}:${canonical}]`] };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`[${css}:${value}]`] };
  }
  return { kind: 'bail', reason: `${prop} value is not static` };
}

const LOGICAL_INSET: Readonly<Record<string, readonly [string, string]>> = {
  paddingStart: ['ps', 'padding-inline-start'],
  paddingEnd: ['pe', 'padding-inline-end'],
  marginStart: ['ms', 'margin-inline-start'],
  marginEnd: ['me', 'margin-inline-end'],
};

export function isLogicalInsetProp(prop: string): boolean {
  return prop in LOGICAL_INSET;
}

/** Dynamic logical insets splice into these dash-case CSS properties. */
export function logicalInsetCssProp(prop: string): string {
  return LOGICAL_INSET[prop]?.[1] ?? prop;
}

export function mapLogicalInsetStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const [prefix, css] = LOGICAL_INSET[prop] ?? ['ps', 'padding-inline-start'];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`${prefix}-[${px(value)}]`] };
  }
  if (typeof value === 'string') {
    return {
      kind: 'classes',
      classes: [`[${css}:${value.replace(/ /g, '_')}]`],
    };
  }
  return { kind: 'bail', reason: `${prop} value is not static` };
}

/** `absoluteFill: true` → `absolute inset-0`; false/absent → omit. */
export function mapAbsoluteFillStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (value === true) {
    return { kind: 'classes', classes: ['absolute', 'inset-0'] };
  }
  return { kind: 'omit' };
}

/** Dynamics: verbatim-safe props splice raw; lookups/transforms bail. */
export function mapEffectDynamic(prop: string): DynamicStyle {
  if (prop === 'pointerEvents') {
    return { kind: 'style', cssProps: ['pointer-events'], wrap: 'raw' };
  }
  if (prop === 'outlineWidth' || prop === 'outlineOffset') {
    return {
      kind: 'style',
      cssProps: [ARBITRARY_PROP[prop] ?? dashCase(prop)],
      wrap: 'px-number-or-string',
    };
  }
  if (prop in ARBITRARY_PROP) {
    return {
      kind: 'style',
      cssProps: [ARBITRARY_PROP[prop] ?? dashCase(prop)],
      wrap: 'raw',
    };
  }
  if (prop === 'boxShadow' || prop in GRID_UTILITY) {
    return { kind: 'style', cssProps: [gridCssProp(prop)], wrap: 'raw' };
  }
  return { kind: 'bail', reason: `${prop} dynamic is not mappable` };
}

function gridCssProp(prop: string): string {
  if (prop === 'boxShadow') return 'box-shadow';
  if (prop === 'gridTemplateColumns') return 'grid-template-columns';
  if (prop === 'gridTemplateRows') return 'grid-template-rows';
  if (prop === 'gridColumn') return 'grid-column';
  return 'grid-row';
}
