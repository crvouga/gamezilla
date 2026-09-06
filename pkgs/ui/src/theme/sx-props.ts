/**
 * Standalone style language for `@pkgs/ui`.
 *
 * Hosts compile `sx` to an inline CSS declaration list whose colors are
 * `var(--ui-color-*)` references, so a scheme switch never recompiles styles.
 */

import type { ColorTokenName, ColorTokens } from './colors';
import type {
  BorderRadiusKey,
  ElevationLevel,
  ElevationStyle,
  fontSize,
  lineHeight,
} from './scale';

export type SxColor = ColorTokenName | (string & {});

export type SxFontSize = number | keyof typeof fontSize;

export type SxLineHeight = number | keyof typeof lineHeight;

export type SxRadius = number | BorderRadiusKey;

export type SxDimension =
  | number
  | `${number}%`
  | 'auto'
  | '100%'
  | (string & {});

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
  | { rotate: string }
  | { rotateX: string }
  | { rotateY: string }
  | { rotateZ: string }
  | { skewX: string }
  | { skewY: string }
  | { perspective: SxNumber };

export type SxNumber = number;

export type SxCompileOptions = {
  colors: ColorTokens;
  elevation: (level: ElevationLevel) => ElevationStyle;
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
  /**
   * Raw longhands (px numbers or CSS lengths such as `env(safe-area-inset-top)`;
   * not scaled). Prefer `p` / `px` / `py` / …
   */
  padding?: SxDimension;
  paddingHorizontal?: SxDimension;
  paddingVertical?: SxDimension;
  paddingTop?: SxDimension;
  paddingBottom?: SxDimension;
  paddingLeft?: SxDimension;
  paddingRight?: SxDimension;
  paddingStart?: SxDimension;
  paddingEnd?: SxDimension;
  margin?: SxDimension;
  marginHorizontal?: SxDimension;
  marginVertical?: SxDimension;
  marginTop?: SxDimension;
  marginBottom?: SxDimension;
  marginLeft?: SxDimension;
  marginRight?: SxDimension;
  marginStart?: SxDimension;
  marginEnd?: SxDimension;
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
  display?:
    | 'flex'
    | 'none'
    | 'block'
    | 'inline'
    | 'inline-flex'
    | 'grid'
    | 'contents';
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
  width?: SxDimension;
  height?: SxDimension;
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
  animationName?: string;
  animationIterationCount?: number | 'infinite';
  animationDuration?: string;
  animationDelay?: string;
  transitionProperty?: string;
  transitionDuration?: string;
  transitionTimingFunction?: string;
  transitionDelay?: string;
  /** Clamp inline text to N lines (pair with `overflow: 'hidden'`). */
  lineClamp?: number;
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line';
  textOverflow?: 'clip' | 'ellipsis';
  backdropFilter?: string;
  willChange?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridColumn?: string;
  gridRow?: string;
  scrollSnapType?: string;
  scrollSnapAlign?: string;
  visibility?: 'visible' | 'hidden';
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
