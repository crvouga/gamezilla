/**
 * Compile `SxProps` to a React Native host style object.
 * Only host adapters and tests should call `theme.sx` / `createSx`.
 */

import type { ColorTokens } from './colors';
import {
  flattenSx,
  type SxCompileOptions,
  type SxInput,
  type SxProps,
} from './sx-props';
import {
  resolveColor,
  resolveFontSize,
  resolveLineHeight,
  resolveRadius,
  resolveSpacing,
} from './sx-resolve';

export type { SxInput, SxProps } from './sx-props';
export { flattenSx } from './sx-props';

/** Opaque RN-compatible style bag. Hosts pass this to the native `style` prop. */
export type ResolvedRnStyle = Record<string, unknown>;

function set(result: ResolvedRnStyle, key: string, value: unknown): void {
  result[key] = value;
}

const DEFAULT_HAIRLINE = 1;

const SPACING_MAP: ReadonlyArray<readonly [keyof SxProps, string]> = [
  ['p', 'padding'],
  ['px', 'paddingHorizontal'],
  ['py', 'paddingVertical'],
  ['pt', 'paddingTop'],
  ['pb', 'paddingBottom'],
  ['pl', 'paddingLeft'],
  ['pr', 'paddingRight'],
  ['m', 'margin'],
  ['mx', 'marginHorizontal'],
  ['my', 'marginVertical'],
  ['mt', 'marginTop'],
  ['mb', 'marginBottom'],
  ['ml', 'marginLeft'],
  ['mr', 'marginRight'],
  ['gap', 'gap'],
  ['rowGap', 'rowGap'],
  ['columnGap', 'columnGap'],
];

const PASSTHROUGH_KEYS: ReadonlyArray<keyof SxProps> = [
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'flexDirection',
  'flexWrap',
  'alignItems',
  'alignSelf',
  'alignContent',
  'justifyContent',
  'display',
  'borderWidth',
  'borderStyle',
  'fontWeight',
  'fontFamily',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'textAlign',
  'textDecorationLine',
  'textTransform',
  'userSelect',
  'opacity',
  'overflow',
  'overflowX',
  'overflowY',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
  'zIndex',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'aspectRatio',
  'boxShadow',
  'transform',
  'transformOrigin',
  'pointerEvents',
  'cursor',
  'outlineStyle',
  'outlineWidth',
  'outlineOffset',
  'animationName',
  'animationIterationCount',
  'animationDuration',
  'transitionProperty',
  'transitionDuration',
];

function applyAbsoluteFill(props: SxProps, result: ResolvedRnStyle): void {
  if (props.absoluteFill !== true) return;
  set(result, 'position', 'absolute');
  set(result, 'top', 0);
  set(result, 'right', 0);
  set(result, 'bottom', 0);
  set(result, 'left', 0);
}

function applyInset(props: SxProps, result: ResolvedRnStyle): void {
  if (typeof props.inset !== 'number') return;
  set(result, 'top', props.inset);
  set(result, 'right', props.inset);
  set(result, 'bottom', props.inset);
  set(result, 'left', props.inset);
}

function applySpacing(props: SxProps, result: ResolvedRnStyle): void {
  for (const [from, to] of SPACING_MAP) {
    const v = props[from];
    if (typeof v === 'number') result[to] = resolveSpacing(v);
  }
}

function applyPassthrough(props: SxProps, result: ResolvedRnStyle): void {
  for (const key of PASSTHROUGH_KEYS) {
    const v = props[key];
    if (v !== undefined) result[key] = v;
  }
}

function applyColors(
  props: SxProps,
  result: ResolvedRnStyle,
  colors: ColorTokens
): void {
  const bg = props.background ?? props.backgroundColor;
  if (bg !== undefined) {
    const resolved = resolveColor(bg, colors);
    if (resolved !== undefined) set(result, 'backgroundColor', resolved);
  }
  if (props.color !== undefined) {
    const resolved = resolveColor(props.color, colors);
    if (resolved !== undefined) set(result, 'color', resolved);
  }
  if (props.borderColor !== undefined) {
    const resolved = resolveColor(props.borderColor, colors);
    if (resolved !== undefined) set(result, 'borderColor', resolved);
  }
  if (props.outlineColor !== undefined) {
    const resolved = resolveColor(props.outlineColor, colors);
    if (resolved !== undefined) set(result, 'outlineColor', resolved);
  }
  const sides = [
    ['borderTopColor', 'borderTopColor'],
    ['borderRightColor', 'borderRightColor'],
    ['borderBottomColor', 'borderBottomColor'],
    ['borderLeftColor', 'borderLeftColor'],
  ] as const;
  for (const [from, to] of sides) {
    const v = props[from];
    if (v === undefined) continue;
    const resolved = resolveColor(v, colors);
    if (resolved !== undefined) result[to] = resolved;
  }
}

function applyRadius(props: SxProps, result: ResolvedRnStyle): void {
  const keys = [
    'borderRadius',
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomLeftRadius',
    'borderBottomRightRadius',
  ] as const;
  for (const key of keys) {
    const n = resolveRadius(props[key]);
    if (n !== undefined) result[key] = n;
  }
}

function applyBorderWidths(
  props: SxProps,
  result: ResolvedRnStyle,
  hairlineWidth: number
): void {
  const sides = [
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
  ] as const;
  for (const key of sides) {
    const v = props[key];
    if (v === undefined) continue;
    result[key] = v === 'hairline' ? hairlineWidth : v;
  }
}

function applyTypography(props: SxProps, result: ResolvedRnStyle): void {
  if (props.fontSize !== undefined) {
    set(result, 'fontSize', resolveFontSize(props.fontSize));
  }
  if (props.lineHeight !== undefined) {
    set(result, 'lineHeight', resolveLineHeight(props.lineHeight));
  }
}

function applyElevation(
  props: SxProps,
  result: ResolvedRnStyle,
  options: SxCompileOptions
): void {
  if (props.elevation === undefined) return;
  const shadow = options.elevation(props.elevation);
  if (shadow.boxShadow && result['boxShadow'] === undefined) {
    set(result, 'boxShadow', shadow.boxShadow);
  }
  if (shadow.elevation !== undefined) {
    set(result, 'elevation', shadow.elevation);
  }
  if (shadow.backgroundColor && result['backgroundColor'] === undefined) {
    set(result, 'backgroundColor', shadow.backgroundColor);
  }
}

export function createSx(
  colors: ColorTokens,
  options?: Pick<SxCompileOptions, 'elevation' | 'hairlineWidth'>
) {
  const ctx: SxCompileOptions = {
    colors,
    elevation: options?.elevation ?? (() => ({})),
    hairlineWidth: options?.hairlineWidth ?? DEFAULT_HAIRLINE,
  };
  const hairline = ctx.hairlineWidth ?? DEFAULT_HAIRLINE;
  return function sx(input: SxInput): ResolvedRnStyle {
    const props = flattenSx(input);
    if (props === undefined) return {};
    const result: ResolvedRnStyle = {};
    applyAbsoluteFill(props, result);
    applyInset(props, result);
    applySpacing(props, result);
    applyPassthrough(props, result);
    applyColors(props, result, ctx.colors);
    applyRadius(props, result);
    applyBorderWidths(props, result, hairline);
    applyTypography(props, result);
    applyElevation(props, result, ctx);
    return result;
  };
}
