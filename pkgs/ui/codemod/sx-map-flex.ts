/**
 * Flex numbers, borders, opacity, cursor, z-index, aspect ratio, inset,
 * logical insets, and outline — static mappings continued from
 * `sx-map-layout.ts`.
 */

import type { DynamicStyle, StaticMapping } from './mapping-types';
import { px } from './sx-map-scale';

function arbitrary(value: string): string {
  return value.replace(/ /g, '_');
}

/** `sx.flex` Yoga contract: 0/-1 → `0 1 auto`; 1 → flex-1; else `[flex:N]`. */
export function mapFlexStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (value === 0 || value === '0' || value === -1 || value === '-1') {
    return { kind: 'classes', classes: ['[flex:0_1_auto]'] };
  }
  if (value === 1 || value === '1') {
    return { kind: 'classes', classes: ['flex-1'] };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`[flex:${value}]`] };
  }
  if (typeof value === 'string') {
    return { kind: 'classes', classes: [`[flex:${arbitrary(value)}]`] };
  }
  return { kind: 'bail', reason: `flex ${String(value)} is not static` };
}

export function mapGrowShrinkStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const base = prop === 'flexGrow' ? 'grow' : 'shrink';
  if (value === 0 || value === '0')
    return { kind: 'classes', classes: [`${base}-0`] };
  if (value === 1 || value === '1') return { kind: 'classes', classes: [base] };
  if (typeof value === 'number' && Number.isFinite(value)) {
    const css = prop === 'flexGrow' ? 'flex-grow' : 'flex-shrink';
    return { kind: 'classes', classes: [`[${css}:${value}]`] };
  }
  return { kind: 'bail', reason: `${prop} ${String(value)} is not static` };
}

const BORDER_WIDTH_CSS: Readonly<Record<string, string>> = {
  borderWidth: 'border-width',
  borderTopWidth: 'border-top-width',
  borderRightWidth: 'border-right-width',
  borderBottomWidth: 'border-bottom-width',
  borderLeftWidth: 'border-left-width',
};

export function isBorderWidthProp(prop: string): boolean {
  return prop in BORDER_WIDTH_CSS;
}

/** Numbers: 0 → `-0`, 1 → bare. `hairline` is 1px only on the bottom edge
 * (the runtime special-cases `borderBottomWidth`); elsewhere it passes
 * through verbatim — invalid CSS the browser drops, so the codemod emits
 * the identical invalid declaration rather than a visible 1px border. */
/** Prop → Tailwind class prefix for width utilities (defaults to `border-l`). */
const BORDER_WIDTH_PREFIX: Readonly<Record<string, string>> = {
  borderWidth: 'border',
  borderTopWidth: 'border-t',
  borderRightWidth: 'border-r',
  borderBottomWidth: 'border-b',
};

export function mapBorderWidthStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const prefix = BORDER_WIDTH_PREFIX[prop] ?? 'border-l';
  const css = BORDER_WIDTH_CSS[prop] ?? 'border-width';
  if (value === 0) return { kind: 'classes', classes: [`${prefix}-0`] };
  if (value === 1) return { kind: 'classes', classes: [prefix] };
  if (value === 'hairline') {
    if (prop === 'borderBottomWidth')
      return { kind: 'classes', classes: [prefix] };
    return { kind: 'classes', classes: [`[${css}:hairline]`] };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`[${css}:${px(value)}]`] };
  }
  if (typeof value === 'string') {
    return { kind: 'classes', classes: [`[${css}:${arbitrary(value)}]`] };
  }
  return { kind: 'bail', reason: `${prop} value is not static` };
}

export function mapBorderStyleStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (value === 'solid') return { kind: 'classes', classes: ['border-solid'] };
  if (value === 'dotted')
    return { kind: 'classes', classes: ['border-dotted'] };
  if (value === 'dashed')
    return { kind: 'classes', classes: ['border-dashed'] };
  return { kind: 'bail', reason: 'borderStyle is not static' };
}

export function mapOpacityStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const pct = value * 100;
    if (Number.isInteger(pct) && pct >= 0 && pct <= 100) {
      return { kind: 'classes', classes: [`opacity-${pct}`] };
    }
    return { kind: 'classes', classes: [`opacity-[${value}]`] };
  }
  return { kind: 'bail', reason: 'opacity is not a static number' };
}

const CURSORS = new Set([
  'auto',
  'default',
  'pointer',
  'wait',
  'text',
  'move',
  'help',
  'not-allowed',
  'none',
  'context-menu',
  'progress',
  'cell',
  'crosshair',
  'vertical-text',
  'alias',
  'copy',
  'no-drop',
  'grab',
  'grabbing',
  'all-scroll',
  'col-resize',
  'row-resize',
]);

export function mapCursorStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'string' && CURSORS.has(value)) {
    return { kind: 'classes', classes: [`cursor-${value}`] };
  }
  if (typeof value === 'string') {
    return { kind: 'classes', classes: [`[cursor:${arbitrary(value)}]`] };
  }
  return { kind: 'bail', reason: 'cursor is not static' };
}

export function mapZIndexStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return {
      kind: 'classes',
      classes: [value < 0 ? `-z-${0 - value}` : `z-${value}`],
    };
  }
  if (typeof value === 'string') {
    return { kind: 'classes', classes: [`[z-index:${arbitrary(value)}]`] };
  }
  return { kind: 'bail', reason: 'zIndex is not static' };
}

export function mapAspectRatioStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`aspect-[${value}]`] };
  }
  if (typeof value === 'string') {
    return { kind: 'classes', classes: [`aspect-[${arbitrary(value)}]`] };
  }
  return { kind: 'bail', reason: 'aspectRatio is not static' };
}

/** Raw `inset` number → four-edge px (mirrors `writeInset`). */
export function mapInsetStatic(
  value: string | number | boolean | null
): StaticMapping {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`inset-[${px(value)}]`] };
  }
  return { kind: 'bail', reason: 'inset is not a static number' };
}

export function mapLogicalInsetStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const prefix = prop === 'start' ? 'start' : 'end';
  const css = prop === 'start' ? 'inset-inline-start' : 'inset-inline-end';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`${prefix}-[${px(value)}]`] };
  }
  if (typeof value === 'string') {
    return { kind: 'classes', classes: [`[${css}:${arbitrary(value)}]`] };
  }
  return { kind: 'bail', reason: `${prop} value is not static` };
}

/** Prop → CSS property for outline utilities (defaults to `outline-color`). */
const OUTLINE_CSS: Readonly<Record<string, string>> = {
  outlineStyle: 'outline-style',
  outlineWidth: 'outline-width',
  outlineOffset: 'outline-offset',
};

export function mapOutlineStatic(
  prop: string,
  value: string | number | boolean | null
): StaticMapping {
  const css = OUTLINE_CSS[prop] ?? 'outline-color';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'classes', classes: [`[${css}:${px(value)}]`] };
  }
  if (typeof value === 'string') {
    return { kind: 'classes', classes: [`[${css}:${arbitrary(value)}]`] };
  }
  return { kind: 'bail', reason: `${prop} value is not static` };
}

/** Dynamics for exact-safe props splice verbatim. `flex` bails: the Yoga
 * `0 → 0 1 auto` rule cannot be reproduced with a verbatim splice. */
/** Prop → CSS property for dynamic verbatim splices (defaults to itself). */
const LAYOUT_DYNAMIC_CSS: Readonly<Record<string, string>> = {
  flexGrow: 'flex-grow',
  flexShrink: 'flex-shrink',
  opacity: 'opacity',
  zIndex: 'z-index',
  cursor: 'cursor',
  aspectRatio: 'aspect-ratio',
};

export function mapLayoutDynamic(prop: string): DynamicStyle {
  if (prop === 'flex') {
    return { kind: 'bail', reason: 'flex dynamic needs the Yoga rule' };
  }
  const cssProp = LAYOUT_DYNAMIC_CSS[prop] ?? prop;
  return { kind: 'style', cssProps: [cssProp], wrap: 'raw' };
}
