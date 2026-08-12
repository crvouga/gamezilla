/**
 * Compile `SxProps` to a CSS declaration string for HTML reports.
 *
 * Hot path: walk the sparse input keys (typical sx has a handful of
 * properties) and dispatch — never scan the full style table.
 */

import type { ColorTokens } from './colors';
import type { ElevationLevel } from './scale';
import {
  flattenSx,
  type SxCompileOptions,
  type SxInput,
  type SxProps,
  type SxRadius,
  type SxTransform,
} from './sx-props';
import {
  resolveColor,
  resolveFontSize,
  resolveLineHeight,
  resolveRadius,
  resolveSpacing,
  snapshotAnimated,
} from './sx-resolve';

type Ctx = {
  d: string[];
  colors: ColorTokens;
  elevation: SxCompileOptions['elevation'];
  props: SxProps;
};

type Writer = (value: unknown, ctx: Ctx) => void;

const EXPO_FONT_RE =
  /^(.+)_(\d{3})(Regular|Medium|SemiBold|Bold|Light|Thin|Black|ExtraBold|ExtraLight)?$/;

const TRANSFORM_PX: Record<string, 1 | undefined> = {
  translateX: 1,
  translateY: 1,
  perspective: 1,
};

function pushPx(d: string[], key: string, n: number): void {
  d.push(key + ':' + (n === 0 ? '0' : n + 'px'));
}

function toLength(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return value === 0 ? '0' : value + 'px';
  if (typeof value !== 'object') return value as string;
  const n = snapshotAnimated(value);
  if (n === undefined) return undefined;
  return n === 0 ? '0' : n + 'px';
}

function toUnitless(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return '' + value;
  if (typeof value !== 'object') return value as string;
  const n = snapshotAnimated(value);
  return n === undefined ? undefined : '' + n;
}

function scaled(cssKey: string): Writer {
  return (value, ctx) => {
    if (typeof value === 'number') pushPx(ctx.d, cssKey, resolveSpacing(value));
  };
}

function scaledPair(a: string, b: string): Writer {
  return (value, ctx) => {
    if (typeof value !== 'number') return;
    const n = resolveSpacing(value);
    pushPx(ctx.d, a, n);
    pushPx(ctx.d, b, n);
  };
}

function rawPair(a: string, b: string): Writer {
  return (value, ctx) => {
    if (typeof value !== 'number') return;
    pushPx(ctx.d, a, value);
    pushPx(ctx.d, b, value);
  };
}

function length(cssKey: string): Writer {
  return (value, ctx) => {
    const v = toLength(value);
    if (v !== undefined) ctx.d.push(cssKey + ':' + v);
  };
}

function unitless(cssKey: string): Writer {
  return (value, ctx) => {
    const v = toUnitless(value);
    if (v !== undefined) ctx.d.push(cssKey + ':' + v);
  };
}

function keyword(cssKey: string): Writer {
  return (value, ctx) => {
    if (value != null) ctx.d.push(cssKey + ':' + value);
  };
}

function color(cssKey: string): Writer {
  return (value, ctx) => {
    if (value == null) return;
    const c = resolveColor(value as string, ctx.colors);
    if (c !== undefined) ctx.d.push(cssKey + ':' + c);
  };
}

function radius(cssKey: string): Writer {
  return (value, ctx) => {
    const n = resolveRadius(value as SxRadius | undefined);
    if (n !== undefined) pushPx(ctx.d, cssKey, n);
  };
}

const writeBg = color('background-color');

function writeBackgroundColor(value: unknown, ctx: Ctx): void {
  if (ctx.props.background !== undefined) return;
  writeBg(value, ctx);
}

function writeAbsoluteFill(value: unknown, ctx: Ctx): void {
  if (value !== true) return;
  ctx.d.push('position:absolute', 'top:0', 'right:0', 'bottom:0', 'left:0');
}

function writeInset(value: unknown, ctx: Ctx): void {
  if (typeof value !== 'number') return;
  const v = value === 0 ? '0' : value + 'px';
  ctx.d.push('top:' + v, 'right:' + v, 'bottom:' + v, 'left:' + v);
}

function quoteFamily(name: string): string {
  return /^[A-Za-z0-9-]+$/.test(name)
    ? name
    : '"' + name.replace(/"/g, '') + '"';
}

function writeFontFamily(value: unknown, ctx: Ctx): void {
  if (typeof value !== 'string') return;
  const match = EXPO_FONT_RE.exec(value);
  const family = match?.[1];
  const weight = match?.[2];
  if (family !== undefined && weight !== undefined) {
    ctx.d.push('font-family:' + quoteFamily(family));
    ctx.d.push('font-weight:' + weight);
    return;
  }
  ctx.d.push('font-family:' + quoteFamily(value));
}

function writeFontSize(value: unknown, ctx: Ctx): void {
  const n = resolveFontSize(value as SxProps['fontSize']);
  if (n !== undefined) pushPx(ctx.d, 'font-size', n);
}

function writeLineHeight(value: unknown, ctx: Ctx): void {
  const n = resolveLineHeight(value as SxProps['lineHeight']);
  if (n !== undefined) pushPx(ctx.d, 'line-height', n);
}

function writeOpacity(value: unknown, ctx: Ctx): void {
  const n = typeof value === 'number' ? value : snapshotAnimated(value);
  if (n !== undefined) ctx.d.push('opacity:' + n);
}

function writeBorderBottomWidth(value: unknown, ctx: Ctx): void {
  if (value === undefined) return;
  const v = toLength(value === 'hairline' ? 1 : value);
  if (v !== undefined) ctx.d.push('border-bottom-width:' + v);
}

function transformPiece(t: SxTransform): string | undefined {
  for (const key in t) {
    const raw = (t as Record<string, unknown>)[key];
    if (raw == null) continue;
    return TRANSFORM_PX[key] === 1
      ? key + '(' + raw + 'px)'
      : key + '(' + raw + ')';
  }
  return undefined;
}

function transformToCss(list: readonly SxTransform[]): string {
  let out = '';
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item === undefined) continue;
    const part = transformPiece(item);
    if (part === undefined) continue;
    out = out.length === 0 ? part : out + ' ' + part;
  }
  return out;
}

function writeTransform(value: unknown, ctx: Ctx): void {
  if (!Array.isArray(value)) return;
  const css = transformToCss(value as readonly SxTransform[]);
  if (css.length > 0) ctx.d.push('transform:' + css);
}

function writePointerEvents(value: unknown, ctx: Ctx): void {
  if (value === 'none' || value === 'box-none') {
    ctx.d.push('pointer-events:none');
    return;
  }
  if (value === 'auto') ctx.d.push('pointer-events:auto');
}

/**
 * RN `flex` is a Yoga number, not CSS `flex` shorthand.
 *
 * - `flex: N` (N > 0) → grow N, shrink 1, basis 0% (CSS `flex:N` already)
 * - `flex: 0` → sized by width/height; may shrink to min size → `0 1 auto`
 * - `flex: -1` (RN-web) → same as `0 1 auto`
 *
 * Bare CSS `flex:0` is `0 1 0%` and collapses the main axis in column
 * flex parents (icons/SVGs paint at height 0).
 */
function writeFlex(value: unknown, ctx: Ctx): void {
  if (value == null) return;
  if (value === 0 || value === '0' || value === -1 || value === '-1') {
    ctx.d.push('flex:0 1 auto');
    return;
  }
  const v = toUnitless(value);
  if (v !== undefined) ctx.d.push('flex:' + v);
}

function writeElevation(value: unknown, ctx: Ctx): void {
  if (value === undefined) return;
  const shadow = ctx.elevation(value as ElevationLevel);
  const { props, d } = ctx;
  if (shadow.boxShadow && props.boxShadow === undefined) {
    d.push('box-shadow:' + shadow.boxShadow);
  }
  if (shadow.backgroundColor === undefined) return;
  if (props.background !== undefined || props.backgroundColor !== undefined) {
    return;
  }
  d.push('background-color:' + shadow.backgroundColor);
}

const WRITERS = {
  p: scaled('padding'),
  px: scaledPair('padding-left', 'padding-right'),
  py: scaledPair('padding-top', 'padding-bottom'),
  pt: scaled('padding-top'),
  pb: scaled('padding-bottom'),
  pl: scaled('padding-left'),
  pr: scaled('padding-right'),
  m: scaled('margin'),
  mx: scaledPair('margin-left', 'margin-right'),
  my: scaledPair('margin-top', 'margin-bottom'),
  mt: scaled('margin-top'),
  mb: scaled('margin-bottom'),
  ml: scaled('margin-left'),
  mr: scaled('margin-right'),
  gap: scaled('gap'),
  rowGap: scaled('row-gap'),
  columnGap: scaled('column-gap'),
  padding: length('padding'),
  paddingHorizontal: rawPair('padding-left', 'padding-right'),
  paddingVertical: rawPair('padding-top', 'padding-bottom'),
  paddingTop: length('padding-top'),
  paddingBottom: length('padding-bottom'),
  paddingLeft: length('padding-left'),
  paddingRight: length('padding-right'),
  paddingStart: length('padding-inline-start'),
  paddingEnd: length('padding-inline-end'),
  margin: length('margin'),
  marginHorizontal: rawPair('margin-left', 'margin-right'),
  marginVertical: rawPair('margin-top', 'margin-bottom'),
  marginTop: length('margin-top'),
  marginBottom: length('margin-bottom'),
  marginLeft: length('margin-left'),
  marginRight: length('margin-right'),
  marginStart: length('margin-inline-start'),
  marginEnd: length('margin-inline-end'),
  flex: writeFlex,
  flexGrow: unitless('flex-grow'),
  flexShrink: unitless('flex-shrink'),
  flexBasis: length('flex-basis'),
  flexDirection: keyword('flex-direction'),
  flexWrap: keyword('flex-wrap'),
  alignItems: keyword('align-items'),
  alignSelf: keyword('align-self'),
  alignContent: keyword('align-content'),
  justifyContent: keyword('justify-content'),
  display: keyword('display'),
  background: writeBg,
  backgroundColor: writeBackgroundColor,
  color: color('color'),
  borderWidth: length('border-width'),
  borderTopWidth: length('border-top-width'),
  borderRightWidth: length('border-right-width'),
  borderBottomWidth: writeBorderBottomWidth,
  borderLeftWidth: length('border-left-width'),
  borderColor: color('border-color'),
  borderTopColor: color('border-top-color'),
  borderRightColor: color('border-right-color'),
  borderBottomColor: color('border-bottom-color'),
  borderLeftColor: color('border-left-color'),
  borderRadius: radius('border-radius'),
  borderTopLeftRadius: radius('border-top-left-radius'),
  borderTopRightRadius: radius('border-top-right-radius'),
  borderBottomLeftRadius: radius('border-bottom-left-radius'),
  borderBottomRightRadius: radius('border-bottom-right-radius'),
  borderStyle: keyword('border-style'),
  fontSize: writeFontSize,
  fontWeight: unitless('font-weight'),
  fontFamily: writeFontFamily,
  fontStyle: keyword('font-style'),
  fontVariant: keyword('font-variant'),
  lineHeight: writeLineHeight,
  letterSpacing: length('letter-spacing'),
  textAlign: keyword('text-align'),
  textDecorationLine: keyword('text-decoration-line'),
  textTransform: keyword('text-transform'),
  userSelect: keyword('user-select'),
  opacity: writeOpacity,
  overflow: keyword('overflow'),
  overflowX: keyword('overflow-x'),
  overflowY: keyword('overflow-y'),
  position: keyword('position'),
  top: length('top'),
  right: length('right'),
  bottom: length('bottom'),
  left: length('left'),
  start: length('inset-inline-start'),
  end: length('inset-inline-end'),
  inset: writeInset,
  zIndex: unitless('z-index'),
  width: length('width'),
  height: length('height'),
  minWidth: length('min-width'),
  maxWidth: length('max-width'),
  minHeight: length('min-height'),
  maxHeight: length('max-height'),
  aspectRatio: unitless('aspect-ratio'),
  absoluteFill: writeAbsoluteFill,
  elevation: writeElevation,
  boxShadow: keyword('box-shadow'),
  transform: writeTransform,
  transformOrigin: keyword('transform-origin'),
  pointerEvents: writePointerEvents,
  cursor: keyword('cursor'),
  outlineStyle: keyword('outline-style'),
  outlineWidth: length('outline-width'),
  outlineColor: color('outline-color'),
  outlineOffset: length('outline-offset'),
  animationIterationCount: unitless('animation-iteration-count'),
  animationDuration: keyword('animation-duration'),
  transitionProperty: keyword('transition-property'),
  transitionDuration: keyword('transition-duration'),
} satisfies { [K in keyof SxProps]?: Writer };

const WRITE: Record<string, Writer | undefined> = WRITERS;

export function sxToCss(input: SxInput, options: SxCompileOptions): string {
  const props = flattenSx(input);
  if (props === undefined) return '';
  const ctx: Ctx = {
    d: [],
    colors: options.colors,
    elevation: options.elevation,
    props,
  };
  for (const key in props) {
    WRITE[key]?.((props as Record<string, unknown>)[key], ctx);
  }
  return ctx.d.join(';');
}
