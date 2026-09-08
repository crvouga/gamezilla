/**
 * Composed sx mapping entrypoint: one static `SxProps`-shaped record in,
 * Tailwind classes + style declarations out.
 *
 * Node-level rules mirrored from `sx-to-css`:
 * - `background` beats `backgroundColor` (the latter is dropped).
 * - `elevation`'s background is dropped when an explicit background is set.
 * - `boxShadow` beats `elevation`'s shadow (elevation only carries a
 *   background today, so both may coexist — kept for parity).
 *
 * `mapSxRecord` handles static values. `mapDynamicProp` handles one dynamic
 * value. Unknown props bail (a future `SxProps` key must not silently drop).
 */

import type { DynamicStyle, StaticMapping, StaticValue } from './mapping-types';
import { isColorProp, mapColorDynamic, mapColorStatic } from './sx-map-color';
import {
  isArbitraryProp,
  isGridProp,
  isLogicalInsetProp,
  isRadiusProp,
  mapAbsoluteFillStatic,
  mapArbitraryStatic,
  mapBoxShadowStatic,
  mapEffectDynamic,
  mapElevationStatic,
  mapGridStatic,
  mapLineClampStatic,
  mapLogicalInsetStatic,
  mapPointerEventsStatic,
  mapRadiusStatic,
} from './sx-map-effect';
import {
  isBorderWidthProp,
  mapAspectRatioStatic,
  mapBorderStyleStatic,
  mapBorderWidthStatic,
  mapCursorStatic,
  mapFlexStatic,
  mapGrowShrinkStatic,
  mapInsetStatic,
  mapLayoutDynamic,
  mapOpacityStatic,
  mapOutlineStatic,
  mapLogicalInsetStatic as mapStartEndStatic,
  mapZIndexStatic,
} from './sx-map-flex';
import {
  isDirectLayoutProp,
  isRawLengthProp,
  isRawPairProp,
  mapDirectLayoutDynamic,
  mapDirectLayoutStatic,
  mapRawLengthStatic,
  mapRawPairStatic,
} from './sx-map-layout';
import {
  isScaledProp,
  mapScaledDynamic,
  mapScaledStatic,
} from './sx-map-scale';
import {
  mapFontSizeStatic,
  mapFontWeightStatic,
  mapLetterSpacingStatic,
  mapLineHeightStatic,
  mapTextDecorationStatic,
  mapTextDynamic,
  mapTextKeywordStatic,
} from './sx-map-text';
import { invariant } from './tiger';

export type MappedSx = {
  readonly classes: readonly string[];
  /** Static declarations that must ride along in `style` (none today). */
  readonly styleDecls: readonly string[];
  /** Props with no exact mapping — non-empty means Tier C. */
  readonly bailed: readonly string[];
};

const TEXT_KEYWORDS = new Set([
  'fontStyle',
  'textAlign',
  'textTransform',
  'userSelect',
  'whiteSpace',
  'textOverflow',
]);

const LAYOUT_DYNAMIC = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'cursor',
  'aspectRatio',
]);

type StaticMapper = (prop: string, value: StaticValue) => StaticMapping;

const STATIC_TABLE: Readonly<Record<string, StaticMapper>> = {
  fontSize: (_prop, value) => mapFontSizeStatic(value),
  lineHeight: (_prop, value) => mapLineHeightStatic(value),
  fontWeight: (_prop, value) => mapFontWeightStatic(value),
  textDecorationLine: (_prop, value) => mapTextDecorationStatic(value),
  letterSpacing: (_prop, value) => mapLetterSpacingStatic(value),
  flex: (_prop, value) => mapFlexStatic(value),
  flexGrow: (prop, value) => mapGrowShrinkStatic(prop, value),
  flexShrink: (prop, value) => mapGrowShrinkStatic(prop, value),
  borderStyle: (_prop, value) => mapBorderStyleStatic(value),
  opacity: (_prop, value) => mapOpacityStatic(value),
  cursor: (_prop, value) => mapCursorStatic(value),
  zIndex: (_prop, value) => mapZIndexStatic(value),
  aspectRatio: (_prop, value) => mapAspectRatioStatic(value),
  inset: (_prop, value) => mapInsetStatic(value),
  start: (prop, value) => mapStartEndStatic(prop, value),
  end: (prop, value) => mapStartEndStatic(prop, value),
  outlineStyle: (prop, value) => mapOutlineStatic(prop, value),
  outlineWidth: (prop, value) => mapOutlineStatic(prop, value),
  outlineOffset: (prop, value) => mapOutlineStatic(prop, value),
  elevation: (_prop, value) => mapElevationStatic(value),
  boxShadow: (_prop, value) => mapBoxShadowStatic(value),
  pointerEvents: (_prop, value) => mapPointerEventsStatic(value),
  lineClamp: (_prop, value) => mapLineClampStatic(value),
  absoluteFill: (_prop, value) => mapAbsoluteFillStatic(value),
};

function mapStaticProp(prop: string, value: StaticValue): StaticMapping {
  if (isScaledProp(prop)) return mapScaledStatic(prop, value);
  if (isColorProp(prop)) return mapColorStatic(prop, value);
  if (TEXT_KEYWORDS.has(prop)) return mapTextKeywordStatic(prop, value);
  if (isDirectLayoutProp(prop)) return mapDirectLayoutStatic(prop, value);
  if (isRawLengthProp(prop)) return mapRawLengthStatic(prop, value);
  if (isRawPairProp(prop)) return mapRawPairStatic(prop, value);
  if (isBorderWidthProp(prop)) return mapBorderWidthStatic(prop, value);
  if (isRadiusProp(prop)) return mapRadiusStatic(prop, value);
  if (isGridProp(prop)) return mapGridStatic(prop, value);
  if (isArbitraryProp(prop)) return mapArbitraryStatic(prop, value);
  if (isLogicalInsetProp(prop)) return mapLogicalInsetStatic(prop, value);
  const tabled = STATIC_TABLE[prop];
  if (tabled !== undefined) return tabled(prop, value);
  if (prop === 'fontVariant') {
    return { kind: 'bail', reason: 'fontVariant arrays are not reversible' };
  }
  if (prop === 'transform') {
    return { kind: 'bail', reason: 'transform handled at the AST layer' };
  }
  return { kind: 'bail', reason: `unknown sx prop ${prop}` };
}

/**
 * Map one static sx record. `transform` entries arrive pre-compiled (the AST
 * layer compiles each `{ translateX: 4 }` piece); pass them via
 * `transformClass`.
 */
export function mapSxRecord(
  record: Readonly<Record<string, StaticValue>>,
  transformClass?: string | undefined
): MappedSx {
  const classes: string[] = [];
  const bailed: string[] = [];
  const background = hasRecordBackground(record);
  for (const prop of Object.keys(record)) {
    accumulateProp(record, prop, {
      classes,
      bailed,
      hasBackground: background,
    });
  }
  if (transformClass !== undefined) classes.push(transformClass);
  assertSingleTokens(classes);
  return { classes, styleDecls: [], bailed };
}

function hasRecordBackground(
  record: Readonly<Record<string, StaticValue>>
): boolean {
  const bg = record['background'];
  const bgColor = record['backgroundColor'];
  return (
    (bg !== undefined && bg !== null) ||
    (bgColor !== undefined && bgColor !== null)
  );
}

type RecordAccum = {
  readonly classes: string[];
  readonly bailed: string[];
  readonly hasBackground: boolean;
};

/** Map one record entry; background/elevation precedence handled here. */
function accumulateProp(
  record: Readonly<Record<string, StaticValue>>,
  prop: string,
  accum: RecordAccum
): void {
  if (prop === 'backgroundColor' && accum.hasBackground) return;
  if (prop === 'transform') return;
  if (prop === 'elevation' && accum.hasBackground) return;
  const raw = record[prop] ?? null;
  if (typeof raw === 'string' && raw.includes('_')) {
    accum.bailed.push(prop);
    return;
  }
  const mapped = mapStaticProp(prop, record[prop] ?? null);
  if (mapped.kind === 'classes') {
    accum.classes.push(...mapped.classes);
  } else if (mapped.kind === 'bail') {
    accum.bailed.push(prop);
  }
}

function assertSingleTokens(classes: readonly string[]): void {
  for (const cls of classes) {
    invariant(
      cls.length > 0 && !/\s/.test(cls),
      `mapped class is not a single token: ${JSON.stringify(cls)}`
    );
  }
}

const TEXT_DYNAMIC = new Set([
  'fontSize',
  'lineHeight',
  'fontWeight',
  'textDecorationLine',
  'letterSpacing',
  ...TEXT_KEYWORDS,
]);

const RAW_DYNAMIC_CSS: Readonly<Record<string, string>> = {
  start: 'inset-inline-start',
  end: 'inset-inline-end',
  inset: 'inset',
  borderTopWidth: 'border-top-width',
  borderRightWidth: 'border-right-width',
  borderBottomWidth: 'border-bottom-width',
  borderLeftWidth: 'border-left-width',
  borderWidth: 'border-width',
};

function isRawDynamicProp(prop: string): boolean {
  return (
    isRawLengthProp(prop) ||
    isRawPairProp(prop) ||
    isLogicalInsetProp(prop) ||
    prop in RAW_DYNAMIC_CSS
  );
}

const EFFECT_DYNAMIC = new Set([
  'pointerEvents',
  'boxShadow',
  'borderStyle',
  'outlineStyle',
  'outlineWidth',
  'outlineOffset',
]);

/** Map one dynamic (expression) value to a style binding or bail. */
export function mapDynamicProp(prop: string): DynamicStyle {
  if (isScaledProp(prop)) return mapScaledDynamic(prop);
  if (isColorProp(prop)) return mapColorDynamic(prop);
  if (TEXT_DYNAMIC.has(prop)) return mapTextDynamic(prop);
  if (isDirectLayoutProp(prop)) return mapDirectLayoutDynamic(prop);
  if (isRawDynamicProp(prop)) {
    return {
      kind: 'style',
      cssProps: [RAW_DYNAMIC_CSS[prop] ?? prop],
      wrap: 'px-number-or-string',
    };
  }
  if (isRadiusProp(prop)) {
    return { kind: 'bail', reason: `${prop} dynamic may be a radius key` };
  }
  if (prop === 'elevation' || prop === 'transform' || prop === 'absoluteFill') {
    return { kind: 'bail', reason: `${prop} dynamic is not mappable` };
  }
  if (LAYOUT_DYNAMIC.has(prop)) return mapLayoutDynamic(prop);
  if (EFFECT_DYNAMIC.has(prop) || isGridProp(prop) || isArbitraryProp(prop)) {
    if (prop === 'borderStyle') {
      return { kind: 'style', cssProps: ['border-style'], wrap: 'raw' };
    }
    return mapEffectDynamic(prop);
  }
  return { kind: 'bail', reason: `unknown sx prop ${prop}` };
}
