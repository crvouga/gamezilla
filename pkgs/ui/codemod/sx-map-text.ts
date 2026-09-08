/**
 * Typography props: `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`,
 * `textAlign`, `textDecorationLine`, `textTransform`, `userSelect`,
 * `whiteSpace`, `textOverflow`, `letterSpacing`.
 *
 * Exactness notes:
 * - Tailwind's default `text-xs…4xl` scale is byte-identical to ours
 *   (12/14/16/18/20/24/30/36), so named sizes map to utilities.
 * - Named `lineHeight`s resolve to numbers that `sx-to-css` emits with a
 *   `px` suffix (`tight` → `1.25px`, matching `tokens.css`). The codemod
 *   preserves that quirk verbatim via `leading-[1.25px]` rather than
 *   "fixing" it to unitless.
 * - `fontWeight` 100–900 map to Tailwind's named weights (identical values).
 * - `fontFamily` always goes to `style` (even when static): arbitrary-value
 *   quoting of comma-separated stacks is not exactly reversible.
 */

import { lineHeight } from '../src/theme/scale';
import type { DynamicStyle, StaticMapping } from './mapping-types';
import { px } from './sx-map-scale';

const FONT_SIZE_UTILITY: Readonly<Record<string, string>> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
};

const FONT_WEIGHT_UTILITY: Readonly<Record<string, string>> = {
  '100': 'font-thin',
  '200': 'font-extralight',
  '300': 'font-light',
  '400': 'font-normal',
  '500': 'font-medium',
  '600': 'font-semibold',
  '700': 'font-bold',
  '800': 'font-extrabold',
  '900': 'font-black',
  normal: 'font-normal',
  bold: 'font-bold',
};

const KEYWORD_UTILITY: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  fontStyle: { normal: 'not-italic', italic: 'italic' },
  textAlign: {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
    justify: 'text-justify',
  },
  textTransform: {
    none: 'normal-case',
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    capitalize: 'capitalize',
  },
  userSelect: {
    auto: 'select-auto',
    none: 'select-none',
    text: 'select-text',
    all: 'select-all',
  },
  whiteSpace: {
    normal: 'whitespace-normal',
    nowrap: 'whitespace-nowrap',
    pre: 'whitespace-pre',
    'pre-wrap': 'whitespace-pre-wrap',
    'pre-line': 'whitespace-pre-line',
  },
  textOverflow: { clip: 'text-clip', ellipsis: 'text-ellipsis' },
};

const TEXT_DECORATION: Readonly<Record<string, readonly string[]>> = {
  none: ['no-underline'],
  underline: ['underline'],
  'line-through': ['line-through'],
  // One declaration, one class: two utilities would cascade (last stylesheet
  // rule wins) instead of painting both decorations.
  'underline line-through': ['[text-decoration-line:underline_line-through]'],
};

export function mapFontSizeStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'string' && value in FONT_SIZE_UTILITY) {
    return {
      kind: 'classes',
      classes: [FONT_SIZE_UTILITY[value] ?? ''],
    };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`text-[${px(value)}]`] };
  }
  return { kind: 'bail', reason: `fontSize ${String(value)} is not static` };
}

export function mapLineHeightStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`leading-[${px(value)}]`] };
  }
  if (typeof value === 'string' && value in lineHeight) {
    const n = lineHeight[value as keyof typeof lineHeight];
    return { kind: 'classes', classes: [`leading-[${px(n)}]`] };
  }
  return { kind: 'bail', reason: `lineHeight ${String(value)} is not static` };
}

export function mapFontWeightStatic(
  value: string | number | boolean | null
): StaticMapping {
  const key = String(value);
  if (key in FONT_WEIGHT_UTILITY) {
    return { kind: 'classes', classes: [FONT_WEIGHT_UTILITY[key] ?? ''] };
  }
  return { kind: 'bail', reason: `fontWeight ${key} has no utility` };
}

export function mapTextDecorationStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'string' && value in TEXT_DECORATION) {
    return {
      kind: 'classes',
      classes: [...(TEXT_DECORATION[value] ?? [])],
    };
  }
  return { kind: 'bail', reason: 'unknown textDecorationLine' };
}

export function mapTextKeywordStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const table = KEYWORD_UTILITY[prop] ?? {};
  if (typeof value === 'string' && value in table) {
    return { kind: 'classes', classes: [table[value] ?? ''] };
  }
  if (prop === 'userSelect' && value === 'contain') {
    return { kind: 'classes', classes: ['[user-select:contain]'] };
  }
  if (prop === 'textAlign' && value === 'auto') {
    return { kind: 'bail', reason: 'textAlign auto has no utility' };
  }
  return { kind: 'bail', reason: `${prop} ${String(value)} has no utility` };
}

export function mapLetterSpacingStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`tracking-[${px(value)}]`] };
  }
  if (typeof value === 'string') {
    return { kind: 'classes', classes: [`tracking-[${value}]`] };
  }
  return { kind: 'bail', reason: 'letterSpacing is not static' };
}

/**
 * Dynamic font sizes/line-heights may be scale keys needing a lookup, so
 * they bail. Keyword props (`fontStyle`, `textAlign`, …) are verbatim-safe
 * because the runtime pushes any string/number through unchanged.
 */
export function mapTextDynamic(prop: string): DynamicStyle {
  if (prop === 'fontSize' || prop === 'lineHeight') {
    return { kind: 'bail', reason: `${prop} dynamic may be a scale key` };
  }
  if (prop in KEYWORD_UTILITY) {
    const cssProp = textKeywordCssProp(prop);
    return { kind: 'style', cssProps: [cssProp], wrap: 'raw' };
  }
  return { kind: 'bail', reason: `${prop} dynamic is not mappable` };
}

function textKeywordCssProp(prop: string): string {
  if (prop === 'fontStyle') return 'font-style';
  if (prop === 'textAlign') return 'text-align';
  if (prop === 'textTransform') return 'text-transform';
  if (prop === 'userSelect') return 'user-select';
  if (prop === 'whiteSpace') return 'white-space';
  return 'text-overflow';
}
