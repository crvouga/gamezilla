/**
 * Tailwind-like sx() style builder.
 * Maps shorthand props to React Native styles.
 */

import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import type { ColorTokens } from './colors';
import { fontSize, spacing, spacingScale } from './scale';

export type ColorTokenName = keyof ColorTokens;

const HAIRLINE = StyleSheet.hairlineWidth;

/** Shorthand props for theme.sx() */
export type SxProps = {
  // Padding
  p?: number;
  px?: number;
  py?: number;
  pt?: number;
  pb?: number;
  pl?: number;
  pr?: number;
  // Margin
  m?: number;
  mx?: number;
  my?: number;
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
  // Layout
  flex?: number;
  flexDirection?: ViewStyle['flexDirection'];
  alignItems?: ViewStyle['alignItems'];
  alignSelf?: ViewStyle['alignSelf'];
  justifyContent?: ViewStyle['justifyContent'];
  gap?: number;
  flexWrap?: ViewStyle['flexWrap'];
  // Background / color
  background?: ColorTokenName | (string & {});
  color?: ColorTokenName | (string & {});
  backgroundColor?: ColorTokenName | string;
  // Border
  borderWidth?: number;
  borderBottomWidth?: number | 'hairline';
  borderColor?: ColorTokenName | string;
  borderRadius?: number;
  // Typography
  fontSize?: number | keyof typeof fontSize;
  fontWeight?: TextStyle['fontWeight'];
  fontFamily?: string;
  lineHeight?: number;
  textDecorationLine?: TextStyle['textDecorationLine'];
  fontStyle?: TextStyle['fontStyle'];
  // Other
  opacity?: number;
  position?: ViewStyle['position'];
  overflow?: ViewStyle['overflow'];
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  transform?: ViewStyle['transform'];
  animationName?: unknown;
  animationIterationCount?: number;
  animationDuration?: string;
  userSelect?: TextStyle['userSelect'];
} & Partial<
  Omit<
    ViewStyle & TextStyle,
    'backgroundColor' | 'color' | 'borderBottomWidth' | 'fontSize'
  >
>;

type ResolvedStyle = ViewStyle & TextStyle;

const SHORTHAND_KEYS = new Set([
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'flex',
  'flexDirection',
  'alignItems',
  'alignSelf',
  'justifyContent',
  'gap',
  'flexWrap',
  'background',
  'color',
  'backgroundColor',
  'borderWidth',
  'borderBottomWidth',
  'borderColor',
  'borderRadius',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  'textDecorationLine',
  'fontStyle',
  'opacity',
  'position',
  'overflow',
  'bottom',
  'left',
  'right',
  'top',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'transform',
]);

function resolveSpacing(n: number): number {
  return spacing[n as keyof typeof spacing] ?? spacingScale(n);
}

function resolveColor(
  value: ColorTokenName | string | undefined,
  colors: ColorTokens
): string | undefined {
  if (!value) return undefined;
  if (value === 'hairline') return undefined; // special case for border width
  if (value in colors) return colors[value as ColorTokenName];
  return value; // hex or rgba
}

function resolveFontSize(
  value: number | keyof typeof fontSize | undefined
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return fontSize[value];
}

/** Pairs of (input shorthand key) → (output style key) for theme spacing. */
const SPACING_MAP: ReadonlyArray<
  readonly [keyof SxProps, keyof ResolvedStyle]
> = [
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
];

/** Direct passthrough keys that share the same name on input and style. */
const PASSTHROUGH_KEYS: ReadonlyArray<keyof SxProps> = [
  'flex',
  'flexDirection',
  'alignItems',
  'alignSelf',
  'justifyContent',
  'flexWrap',
  'borderWidth',
  'borderRadius',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  'textDecorationLine',
  'fontStyle',
  'opacity',
  'position',
  'overflow',
  'bottom',
  'left',
  'right',
  'top',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'transform',
];

function applySpacing(props: SxProps, result: ResolvedStyle): void {
  for (const [from, to] of SPACING_MAP) {
    const v = props[from];
    if (typeof v === 'number') {
      (result as Record<string, unknown>)[to] = resolveSpacing(v);
    }
  }
}

function applyPassthrough(props: SxProps, result: ResolvedStyle): void {
  for (const key of PASSTHROUGH_KEYS) {
    const v = props[key];
    if (v !== undefined) {
      (result as Record<string, unknown>)[key] = v;
    }
  }
}

function applyColors(
  props: SxProps,
  result: ResolvedStyle,
  colors: ColorTokens
): void {
  const bg = props.background ?? props.backgroundColor;
  if (bg !== undefined) result.backgroundColor = resolveColor(bg, colors);
  if (props.color !== undefined) {
    result.color = resolveColor(props.color, colors);
  }
  if (props.borderColor !== undefined) {
    result.borderColor = resolveColor(props.borderColor, colors);
  }
}

function applyBorderBottom(props: SxProps, result: ResolvedStyle): void {
  if (props.borderBottomWidth === undefined) return;
  result.borderBottomWidth =
    props.borderBottomWidth === 'hairline' ? HAIRLINE : props.borderBottomWidth;
}

function applyTypography(props: SxProps, result: ResolvedStyle): void {
  if (props.fontSize !== undefined) {
    result.fontSize = resolveFontSize(props.fontSize);
  }
}

function applyOverflow(props: SxProps, result: ResolvedStyle): void {
  for (const key of Object.keys(props)) {
    if (SHORTHAND_KEYS.has(key)) continue;
    const val = (props as Record<string, unknown>)[key];
    if (val !== undefined) {
      (result as Record<string, unknown>)[key] = val;
    }
  }
}

export function createSx(colors: ColorTokens) {
  return function sx(props: SxProps): ResolvedStyle {
    const result: ResolvedStyle = {};
    applySpacing(props, result);
    applyPassthrough(props, result);
    applyColors(props, result, colors);
    applyBorderBottom(props, result);
    applyTypography(props, result);
    applyOverflow(props, result);
    return result;
  };
}
