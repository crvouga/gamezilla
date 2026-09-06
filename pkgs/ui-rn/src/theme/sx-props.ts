/**
 * Standalone style language for `@pkgs/ui-rn`.
 *
 * No React Native `ViewStyle` / `TextStyle` / `StyleSheet` types.
 * Runtime adapters compile this to RN styles; reports compile it to CSS.
 */

import type { ColorTokens } from './colors';
import type {
  BorderRadiusKey,
  ElevationLevel,
  ElevationStyle,
  fontSize,
  lineHeight,
} from './scale';

export type ColorTokenName = keyof ColorTokens;

export type SxColor = ColorTokenName | (string & {});

export type SxFontSize = number | keyof typeof fontSize;

export type SxLineHeight = number | keyof typeof lineHeight;

export type SxRadius = number | BorderRadiusKey;

export type SxDimension =
  | number
  | `${number}%`
  | 'auto'
  | '100%'
  | (string & {})
  | SxAnimatedNode;

export type SxFlexDirection =
  | 'row'
  | 'column'
  | 'row-reverse'
  | 'column-reverse';

export type SxAlign =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'stretch'
  | 'baseline';

export type SxJustify =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export type SxWrap = 'wrap' | 'nowrap' | 'wrap-reverse';

export type SxOverflow = 'visible' | 'hidden' | 'scroll';

export type SxPosition = 'absolute' | 'relative' | 'static' | 'fixed';

export type SxFontWeight =
  | 'normal'
  | 'bold'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900;

export type SxTextAlign = 'auto' | 'left' | 'right' | 'center' | 'justify';

export type SxTextDecoration =
  | 'none'
  | 'underline'
  | 'line-through'
  | 'underline line-through';

export type SxTextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export type SxPointerEvents = 'auto' | 'none' | 'box-none' | 'box-only';

export type SxTransform =
  | { translateX: SxNumber }
  | { translateY: SxNumber }
  | { scale: SxNumber }
  | { scaleX: SxNumber }
  | { scaleY: SxNumber }
  | { rotate: string | SxAnimatedNode }
  | { rotateX: string | SxAnimatedNode }
  | { rotateY: string | SxAnimatedNode }
  | { rotateZ: string | SxAnimatedNode }
  | { skewX: string }
  | { skewY: string }
  | { perspective: SxNumber };

/**
 * RN Animated / Reanimated nodes are class instances (private fields) and
 * cannot structurally match a method interface. Hosts pass them through.
 */
export type SxAnimatedNode = object;

export type SxNumber = number | SxAnimatedNode;

export type SxCompileOptions = {
  colors: ColorTokens;
  elevation: (level: ElevationLevel) => ElevationStyle;
  /** RN hairline; CSS compiler always emits `1px`. Defaults to `1`. */
  hairlineWidth?: number;
};

/** Utility-first style object. Shorthands (`p`, `px`, `gap`) use the 4px scale. */
export type SxProps = {
  p?: number;
  px?: number;
  py?: number;
  pt?: number;
  pb?: number;
  pl?: number;
  pr?: number;
  m?: number;
  mx?: number;
  my?: number;
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  /** Raw-pixel longhands (not scaled). Prefer `p` / `px` / `py` / … */
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingStart?: number;
  paddingEnd?: number;
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginStart?: number;
  marginEnd?: number;
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: SxDimension;
  flexDirection?: SxFlexDirection;
  flexWrap?: SxWrap;
  alignItems?: SxAlign;
  alignSelf?: SxAlign | 'auto';
  alignContent?: SxAlign | 'space-between' | 'space-around' | 'space-evenly';
  justifyContent?: SxJustify;
  display?: 'flex' | 'none';
  background?: SxColor;
  backgroundColor?: SxColor;
  color?: SxColor;
  borderWidth?: number;
  borderTopWidth?: number | 'hairline';
  borderRightWidth?: number | 'hairline';
  borderBottomWidth?: number | 'hairline';
  borderLeftWidth?: number | 'hairline';
  borderColor?: SxColor;
  borderTopColor?: SxColor;
  borderRightColor?: SxColor;
  borderBottomColor?: SxColor;
  borderLeftColor?: SxColor;
  borderRadius?: SxRadius;
  borderTopLeftRadius?: SxRadius;
  borderTopRightRadius?: SxRadius;
  borderBottomLeftRadius?: SxRadius;
  borderBottomRightRadius?: SxRadius;
  borderStyle?: 'solid' | 'dotted' | 'dashed';
  fontSize?: SxFontSize;
  fontWeight?: SxFontWeight;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontVariant?: readonly string[];
  lineHeight?: SxLineHeight;
  letterSpacing?: number;
  textAlign?: SxTextAlign;
  textDecorationLine?: SxTextDecoration;
  textTransform?: SxTextTransform;
  userSelect?: 'auto' | 'none' | 'text' | 'contain' | 'all';
  opacity?: SxNumber;
  overflow?: SxOverflow;
  overflowX?: SxOverflow;
  overflowY?: SxOverflow;
  position?: SxPosition;
  top?: SxDimension;
  right?: SxDimension;
  bottom?: SxDimension;
  left?: SxDimension;
  start?: SxDimension;
  end?: SxDimension;
  inset?: number;
  zIndex?: number;
  width?: SxDimension | SxAnimatedNode;
  height?: SxDimension | SxAnimatedNode;
  minWidth?: SxDimension;
  maxWidth?: SxDimension;
  minHeight?: SxDimension;
  maxHeight?: SxDimension;
  aspectRatio?: number | string;
  absoluteFill?: boolean;
  elevation?: ElevationLevel;
  boxShadow?: string;
  transform?: readonly SxTransform[];
  transformOrigin?: string;
  pointerEvents?: SxPointerEvents;
  cursor?: string;
  outlineStyle?: 'solid' | 'dotted' | 'dashed' | 'none';
  outlineWidth?: number;
  outlineColor?: SxColor;
  outlineOffset?: number;
  animationName?: unknown;
  animationIterationCount?: number | 'infinite';
  animationDuration?: string;
  /** Web CSS transition (RN-web). */
  transitionProperty?: string;
  transitionDuration?: string;
};

export type SxInput = SxProps | readonly SxInput[] | undefined | null | false;

export function flattenSx(input: SxInput): SxProps | undefined {
  if (input == null || input === false) return undefined;
  if (!Array.isArray(input)) return input as SxProps;
  const out: SxProps = {};
  let any = false;
  for (const entry of input as readonly SxInput[]) {
    const flat = flattenSx(entry);
    if (flat === undefined) continue;
    Object.assign(out, flat);
    any = true;
  }
  return any ? out : undefined;
}
