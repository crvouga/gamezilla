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

import type {
  DynamicStyle,
  StaticMapping,
  StaticValue,
} from './mapping-types';
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
  mapLogicalInsetStatic as mapStartEndStatic,
  mapOpacityStatic,
  mapOutlineStatic,
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
  isFontSizeProp,
  mapFontSizeStatic,
  mapFontWeightStatic,
  mapLetterSpacingStatic,
  mapLineHeightStatic,
  mapTextDecorationStatic,
  mapTextDynamic,
  mapTextKeywordStatic,
} from './sx-map-text';
import { isColorProp, mapColorDynamic, mapColorStatic } from './sx-map-color';
import { isScaledProp, mapScaledDynamic, mapScaledStatic } from './sx-map-scale';

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

function mapStaticProp(prop: string, value: StaticValue): StaticMapping {
  if (isScaledProp(prop)) return mapScaledStatic(prop, value);
  if (isColorProp(prop)) return mapColorStatic(prop, value);
  if (isFontSizeProp(prop)) return mapFontSizeStatic(value);
  if (prop === 'lineHeight') return mapLineHeightStatic(value);
  if (prop === 'fontWeight') return mapFontWeightStatic(value);
  if (prop === 'textDecorationLine') return mapTextDecorationStatic(value);
  if (TEXT_KEYWORDS.has(prop)) return mapTextKeywordStatic(prop, value);
  if (prop === 'letterSpacing') return mapLetterSpacingStatic(value);
  if (isDirectLayoutProp(prop)) return mapDirectLayoutStatic(prop, value);
  if (isRawLengthProp(prop)) return mapRawLengthStatic(prop, value);
  if (isRawPairProp(prop)) return mapRawPairStatic(prop, value);
  if (prop === 'flex') return mapFlexStatic(value);
  if (prop === 'flexGrow' || prop === 'flexShrink') {
    return mapGrowShrinkStatic(prop, value);
  }
  if (isBorderWidthProp(prop)) return mapBorderWidthStatic(prop, value);
  if (prop === 'borderStyle') return mapBorderStyleStatic(value);
  if (prop === 'opacity') return mapOpacityStatic(value);
  if (prop === 'cursor') return mapCursorStatic(value);
  if (prop === 'zIndex') return mapZIndexStatic(value);
  if (prop === 'aspectRatio') return mapAspectRatioStatic(value);
  if (prop === 'inset') return mapInsetStatic(value);
  if (prop === 'start' || prop === 'end') return mapStartEndStatic(prop, value);
  if (
    prop === 'outlineStyle' ||
    prop === 'outlineWidth' ||
    prop === 'outlineOffset'
  ) {
    return mapOutlineStatic(prop, value);
  }
  if (isRadiusProp(prop)) return mapRadiusStatic(prop, value);
  if (prop === 'elevation') return mapElevationStatic(value);
  if (prop === 'boxShadow') return mapBoxShadowStatic(value);
  if (prop === 'pointerEvents') return mapPointerEventsStatic(value);
  if (prop === 'lineClamp') return mapLineClampStatic(value);
  if (isGridProp(prop)) return mapGridStatic(prop, value);
  if (isArbitraryProp(prop)) return mapArbitraryStatic(prop, value);
  if (isLogicalInsetProp(prop)) return mapLogicalInsetStatic(prop, value);
  if (prop === 'absoluteFill') return mapAbsoluteFillStatic(value);
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
  const hasBackground =
    record['background'] !== undefined && record['background'] !== null;
  for (const prop of Object.keys(record)) {
    if (prop === 'backgroundColor' && hasBackground) continue;
    if (prop === 'transform') continue;
    if (prop === 'elevation' && hasBackground) continue;
    const mapped = mapStaticProp(prop, record[prop] ?? null);
    if (mapped.kind === 'classes') {
      classes.push(...mapped.classes);
    } else if (mapped.kind === 'bail') {
      bailed.push(prop);
    }
  }
  if (transformClass !== undefined) classes.push(transformClass);
  return { classes, styleDecls: [], bailed };
}

/** Map one dynamic (expression) value to a style binding or bail. */
export function mapDynamicProp(prop: string): DynamicStyle {
  if (isScaledProp(prop)) return mapScaledDynamic(prop);
  if (isColorProp(prop)) return mapColorDynamic(prop);
  if (
    prop === 'fontSize' ||
    prop === 'lineHeight' ||
    prop === 'fontWeight' ||
    prop === 'textDecorationLine' ||
    prop === 'letterSpacing' ||
    TEXT_KEYWORDS.has(prop)
  ) {
    return mapTextDynamic(prop);
  }
  if (isDirectLayoutProp(prop)) return mapDirectLayoutDynamic(prop);
  if (
    isRawLengthProp(prop) ||
    isRawPairProp(prop) ||
    isLogicalInsetProp(prop) ||
    prop === 'start' ||
    prop === 'end' ||
    prop === 'inset'
  ) {
    return { kind: 'style', cssProp: dynamicCssProp(prop), wrap: 'px-number-or-string' };
  }
  if (isRadiusProp(prop)) {
    return { kind: 'bail', reason: `${prop} dynamic may be a radius key` };
  }
  if (prop === 'elevation' || prop === 'transform' || prop === 'absoluteFill') {
    return { kind: 'bail', reason: `${prop} dynamic is not mappable` };
  }
  if (LAYOUT_DYNAMIC.has(prop)) return mapLayoutDynamic(prop);
  if (
    prop === 'pointerEvents' ||
    prop === 'boxShadow' ||
    isGridProp(prop) ||
    isArbitraryProp(prop)
  ) {
    return mapEffectDynamic(prop);
  }
  if (isBorderWidthProp(prop)) {
    return {
      kind: 'style',
      cssProp: borderWidthCssProp(prop),
      wrap: 'px-number-or-string',
    };
  }
  if (prop === 'borderStyle') {
    return { kind: 'style', cssProp: 'border-style', wrap: 'raw' };
  }
  if (
    prop === 'outlineStyle' ||
    prop === 'outlineWidth' ||
    prop === 'outlineOffset'
  ) {
    return mapEffectDynamic(prop);
  }
  return { kind: 'bail', reason: `unknown sx prop ${prop}` };
}

function borderWidthCssProp(prop: string): string {
  if (prop === 'borderTopWidth') return 'border-top-width';
  if (prop === 'borderRightWidth') return 'border-right-width';
  if (prop === 'borderBottomWidth') return 'border-bottom-width';
  if (prop === 'borderLeftWidth') return 'border-left-width';
  return 'border-width';
}

function dynamicCssProp(prop: string): string {
  if (prop === 'start') return 'inset-inline-start';
  if (prop === 'end') return 'inset-inline-end';
  if (prop === 'inset') return 'inset';
  return prop;
}
