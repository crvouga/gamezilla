/**
 * Color props (`background`, `color`, `border*Color`, `outlineColor`).
 *
 * Mirrors `sx-resolve.resolveColor` exactly: palette tokens + intent aliases
 * (`danger`/`error` → `destructive`, `primary` → `tint`) resolve to
 * `var(--ui-color-*)`; CSS keywords and non-token-like strings pass through
 * (exact only when they name a renderable color — hex/rgb/hsl/keywords map
 * to arbitrary values); unknown bare identifiers emit nothing at runtime,
 * so the codemod omits them too.
 *
 * Token utilities (`bg-surface`) resolve through this codemod's `theme.css`,
 * which declares `@theme --color-<kebab>: var(--ui-color-<kebab>)` — the
 * Tailwind v4 idiom for CSS-variable-backed themes. Scheme switching keeps
 * working because the value is still the same variable.
 */

import { COLOR_PALETTE } from '../src/theme/colors/color-palette';
import type { DynamicStyle, StaticMapping } from './mapping-types';
import { invariant } from './tiger';

const TOKEN_NAMES = new Set(Object.keys(COLOR_PALETTE.light));

const COLOR_ALIASES: Readonly<Record<string, string>> = {
  danger: 'destructive',
  error: 'destructive',
  primary: 'tint',
};

const CSS_COLOR_KEYWORDS = new Set([
  'transparent',
  'inherit',
  'currentcolor',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

const TOKEN_LIKE = /^[a-zA-Z][\w-]*$/;

/** camelCase token → kebab Tailwind theme key (`surfaceElevated` → `surface-elevated`). */
export function tokenToKebab(name: string): string {
  const kebab = name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  invariant(kebab.length > 0, 'tokenToKebab got an empty name');
  return kebab;
}

/** Resolve an sx color to its exact CSS value, mirroring `resolveColor`. */
export function resolveStaticColor(value: string): string | undefined {
  const aliased = COLOR_ALIASES[value] ?? value;
  if (TOKEN_NAMES.has(aliased))
    return `var(--ui-color-${tokenToKebab(aliased)})`;
  if (CSS_COLOR_KEYWORDS.has(aliased.toLowerCase())) return aliased;
  if (!TOKEN_LIKE.test(aliased)) return aliased;
  return undefined;
}

const COLOR_UTILITY: Readonly<Record<string, string>> = {
  background: 'bg',
  backgroundColor: 'bg',
  color: 'text',
  borderColor: 'border',
  borderTopColor: 'border-t',
  borderRightColor: 'border-r',
  borderBottomColor: 'border-b',
  borderLeftColor: 'border-l',
  outlineColor: 'outline',
};

export function isColorProp(prop: string): boolean {
  return prop in COLOR_UTILITY;
}

function arbitraryColorClass(prefix: string, cssValue: string): string {
  return `${prefix}-[${cssValue.replace(/ /g, '_')}]`;
}

const KEYWORD_UTILITY: Readonly<Record<string, string>> = {
  transparent: 'transparent',
  inherit: 'inherit',
  currentcolor: 'current',
};

/** Map a static color value to a token utility or an arbitrary value. */
export function mapColorStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value !== 'string') return { kind: 'omit' };
  const resolved = resolveStaticColor(value);
  if (resolved === undefined) return { kind: 'omit' };
  const prefix = COLOR_UTILITY[prop] ?? prop;
  if (resolved.startsWith('var(--ui-color-')) {
    return {
      kind: 'classes',
      classes: [`${prefix}-${tokenToKebab(COLOR_ALIASES[value] ?? value)}`],
    };
  }
  const keyword = KEYWORD_UTILITY[resolved.toLowerCase()];
  if (keyword !== undefined) {
    return { kind: 'classes', classes: [`${prefix}-${keyword}`] };
  }
  return { kind: 'classes', classes: [arbitraryColorClass(prefix, resolved)] };
}

/** Dynamic colors need token resolution at runtime — bail (no helper). */
export function mapColorDynamic(prop: string): DynamicStyle {
  return { kind: 'bail', reason: `${prop} needs runtime token resolution` };
}
