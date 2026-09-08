/**
 * Layout props: flex model, display, position, dimensions, borders, outline,
 * overflow, opacity, visibility, z-index, cursor, aspect ratio, inset.
 *
 * Exactness notes:
 * - Raw lengths (`width`, `top`, `flexBasis`, …) are NOT scaled: numbers
 *   mean px. They map to arbitrary values (`w-[5px]`), never to the spacing
 *   scale. Strings pass through with spaces escaped as `_`.
 * - `flex` keeps the Yoga contract: `0`/`-1` → `0 1 auto` (NOT bare CSS
 *   `flex:0`, which collapses in column parents); `1` → `flex-1`
 *   (`1 1 0%`, identical); other numbers → `[flex:N]`.
 * - Outline style/width/offset use arbitrary properties: Tailwind v4
 *   redefined `outline-none`, so only the property form is exact.
 */

import type { DynamicStyle, StaticMapping } from './mapping-types';
import { px } from './sx-map-scale';

function arbitrary(value: string): string {
  return value.replace(/ /g, '_');
}

const DIRECT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  display: {
    flex: 'flex',
    none: 'hidden',
    block: 'block',
    inline: 'inline',
    'inline-flex': 'inline-flex',
    grid: 'grid',
    contents: 'contents',
  },
  flexDirection: {
    row: 'flex-row',
    column: 'flex-col',
    'row-reverse': 'flex-row-reverse',
    'column-reverse': 'flex-col-reverse',
  },
  flexWrap: {
    wrap: 'flex-wrap',
    nowrap: 'flex-nowrap',
    'wrap-reverse': 'flex-wrap-reverse',
  },
  alignItems: {
    'flex-start': 'items-start',
    'flex-end': 'items-end',
    center: 'items-center',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  },
  alignSelf: {
    auto: 'self-auto',
    'flex-start': 'self-start',
    'flex-end': 'self-end',
    center: 'self-center',
    stretch: 'self-stretch',
    baseline: 'self-baseline',
  },
  alignContent: {
    'flex-start': 'content-start',
    'flex-end': 'content-end',
    center: 'content-center',
    stretch: 'content-stretch',
    baseline: 'content-baseline',
    'space-between': 'content-between',
    'space-around': 'content-around',
    'space-evenly': 'content-evenly',
  },
  justifyContent: {
    'flex-start': 'justify-start',
    'flex-end': 'justify-end',
    center: 'justify-center',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
    'space-evenly': 'justify-evenly',
  },
  overflow: {
    visible: 'overflow-visible',
    hidden: 'overflow-hidden',
    scroll: 'overflow-scroll',
  },
  overflowX: {
    visible: 'overflow-x-visible',
    hidden: 'overflow-x-hidden',
    scroll: 'overflow-x-scroll',
  },
  overflowY: {
    visible: 'overflow-y-visible',
    hidden: 'overflow-y-hidden',
    scroll: 'overflow-y-scroll',
  },
  position: {
    absolute: 'absolute',
    relative: 'relative',
    static: 'static',
    fixed: 'fixed',
  },
  visibility: { visible: 'visible', hidden: 'invisible' },
};

const DIRECT_CSS_PROP: Readonly<Record<string, string>> = {
  display: 'display',
  flexDirection: 'flex-direction',
  flexWrap: 'flex-wrap',
  alignItems: 'align-items',
  alignSelf: 'align-self',
  alignContent: 'align-content',
  justifyContent: 'justify-content',
  overflow: 'overflow',
  overflowX: 'overflow-x',
  overflowY: 'overflow-y',
  position: 'position',
  visibility: 'visibility',
};

export function isDirectLayoutProp(prop: string): boolean {
  return prop in DIRECT;
}

export function mapDirectLayoutStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const table = DIRECT[prop] ?? {};
  if (typeof value === 'string' && value in table) {
    return { kind: 'classes', classes: [table[value] ?? ''] };
  }
  return { kind: 'bail', reason: `${prop} ${String(value)} has no utility` };
}

export function mapDirectLayoutDynamic(prop: string): DynamicStyle {
  const cssProp = DIRECT_CSS_PROP[prop] ?? prop;
  return { kind: 'style', cssProps: [cssProp], wrap: 'raw' };
}

const RAW_LENGTH: Readonly<Record<string, string>> = {
  padding: 'p',
  paddingTop: 'pt',
  paddingBottom: 'pb',
  paddingLeft: 'pl',
  paddingRight: 'pr',
  margin: 'm',
  marginTop: 'mt',
  marginBottom: 'mb',
  marginLeft: 'ml',
  marginRight: 'mr',
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
  start: 'start',
  end: 'end',
  width: 'w',
  height: 'h',
  minWidth: 'min-w',
  maxWidth: 'max-w',
  minHeight: 'min-h',
  maxHeight: 'max-h',
  flexBasis: 'basis',
  letterSpacingRaw: 'tracking',
};

export function isRawLengthProp(prop: string): boolean {
  return prop in RAW_LENGTH;
}

export function mapRawLengthStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const prefix = RAW_LENGTH[prop] ?? prop;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`${prefix}-[${px(value)}]`] };
  }
  if (typeof value === 'string') {
    if (value === 'auto' && (prop === 'width' || prop === 'height')) {
      return {
        kind: 'classes',
        classes: [prop === 'width' ? 'w-auto' : 'h-auto'],
      };
    }
    return { kind: 'classes', classes: [`${prefix}-[${arbitrary(value)}]`] };
  }
  return { kind: 'bail', reason: `${prop} value is not static` };
}

const RAW_PAIRS: Readonly<Record<string, readonly [string, string]>> = {
  paddingHorizontal: ['padding-left', 'padding-right'],
  paddingVertical: ['padding-top', 'padding-bottom'],
  marginHorizontal: ['margin-left', 'margin-right'],
  marginVertical: ['margin-top', 'margin-bottom'],
};

export function isRawPairProp(prop: string): boolean {
  return prop in RAW_PAIRS;
}

export function mapRawPairStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const decls = RAW_PAIRS[prop] ?? ['left', 'right'];
  if (typeof value === 'number' && Number.isFinite(value)) {
    const v = px(value);
    return {
      kind: 'classes',
      classes: [`[${decls.map((d) => `${d}:${v}`).join(';')}]`],
    };
  }
  if (typeof value === 'string') {
    const v = arbitrary(value);
    return {
      kind: 'classes',
      classes: [`[${decls.map((d) => `${d}:${v}`).join(';')}]`],
    };
  }
  return { kind: 'bail', reason: `${prop} value is not static` };
}
