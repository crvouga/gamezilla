/**
 * Compile `SxProps` to a CSS declaration string for HTML reports.
 */

import type { ColorTokens } from './colors';
import {
  flattenSx,
  type SxCompileOptions,
  type SxInput,
  type SxProps,
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

const UNITLESS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'fontWeight',
  'aspectRatio',
  'animationIterationCount',
]);

const EXPO_FONT_RE =
  /^(.+)_(\d{3})(Regular|Medium|SemiBold|Bold|Light|Thin|Black|ExtraBold|ExtraLight)?$/;

const SKIP_CSS = new Set([
  'elevation',
  'includeFontPadding',
  'textAlignVertical',
  'animationName',
]);

const SPACING_CSS: ReadonlyArray<readonly [keyof SxProps, string]> = [
  ['p', 'padding'],
  ['px', 'padding-left'],
  ['py', 'padding-top'],
  ['pt', 'padding-top'],
  ['pb', 'padding-bottom'],
  ['pl', 'padding-left'],
  ['pr', 'padding-right'],
  ['m', 'margin'],
  ['mx', 'margin-left'],
  ['my', 'margin-top'],
  ['mt', 'margin-top'],
  ['mb', 'margin-bottom'],
  ['ml', 'margin-left'],
  ['mr', 'margin-right'],
  ['gap', 'gap'],
  ['rowGap', 'row-gap'],
  ['columnGap', 'column-gap'],
];

const PAIR_CSS: ReadonlyArray<readonly [keyof SxProps, string, string]> = [
  ['px', 'padding-right', 'padding-left'],
  ['py', 'padding-bottom', 'padding-top'],
  ['mx', 'margin-right', 'margin-left'],
  ['my', 'margin-bottom', 'margin-top'],
  ['paddingHorizontal', 'padding-left', 'padding-right'],
  ['paddingVertical', 'padding-top', 'padding-bottom'],
  ['marginHorizontal', 'margin-left', 'margin-right'],
  ['marginVertical', 'margin-top', 'margin-bottom'],
];

const DIRECT_CSS: ReadonlyArray<readonly [keyof SxProps, string]> = [
  ['padding', 'padding'],
  ['paddingTop', 'padding-top'],
  ['paddingBottom', 'padding-bottom'],
  ['paddingLeft', 'padding-left'],
  ['paddingRight', 'padding-right'],
  ['paddingStart', 'padding-inline-start'],
  ['paddingEnd', 'padding-inline-end'],
  ['margin', 'margin'],
  ['marginTop', 'margin-top'],
  ['marginBottom', 'margin-bottom'],
  ['marginLeft', 'margin-left'],
  ['marginRight', 'margin-right'],
  ['marginStart', 'margin-inline-start'],
  ['marginEnd', 'margin-inline-end'],
  ['flex', 'flex'],
  ['flexGrow', 'flex-grow'],
  ['flexShrink', 'flex-shrink'],
  ['flexBasis', 'flex-basis'],
  ['flexDirection', 'flex-direction'],
  ['flexWrap', 'flex-wrap'],
  ['alignItems', 'align-items'],
  ['alignSelf', 'align-self'],
  ['alignContent', 'align-content'],
  ['justifyContent', 'justify-content'],
  ['display', 'display'],
  ['borderWidth', 'border-width'],
  ['borderTopWidth', 'border-top-width'],
  ['borderRightWidth', 'border-right-width'],
  ['borderLeftWidth', 'border-left-width'],
  ['borderStyle', 'border-style'],
  ['fontWeight', 'font-weight'],
  ['fontStyle', 'font-style'],
  ['fontVariant', 'font-variant'],
  ['letterSpacing', 'letter-spacing'],
  ['textAlign', 'text-align'],
  ['textDecorationLine', 'text-decoration-line'],
  ['textTransform', 'text-transform'],
  ['userSelect', 'user-select'],
  ['overflow', 'overflow'],
  ['overflowX', 'overflow-x'],
  ['overflowY', 'overflow-y'],
  ['position', 'position'],
  ['top', 'top'],
  ['right', 'right'],
  ['bottom', 'bottom'],
  ['left', 'left'],
  ['start', 'inset-inline-start'],
  ['end', 'inset-inline-end'],
  ['zIndex', 'z-index'],
  ['width', 'width'],
  ['height', 'height'],
  ['minWidth', 'min-width'],
  ['maxWidth', 'max-width'],
  ['minHeight', 'min-height'],
  ['maxHeight', 'max-height'],
  ['aspectRatio', 'aspect-ratio'],
  ['boxShadow', 'box-shadow'],
  ['transformOrigin', 'transform-origin'],
  ['cursor', 'cursor'],
  ['outlineStyle', 'outline-style'],
  ['outlineWidth', 'outline-width'],
  ['outlineOffset', 'outline-offset'],
  ['animationDuration', 'animation-duration'],
  ['animationIterationCount', 'animation-iteration-count'],
  ['transitionProperty', 'transition-property'],
  ['transitionDuration', 'transition-duration'],
];

function cssNumber(key: string, value: number): string {
  if (UNITLESS.has(key) || value === 0) return String(value);
  return `${value}px`;
}

function cssValue(key: string, value: unknown): string | undefined {
  if (value == null || SKIP_CSS.has(key)) return undefined;
  if (typeof value === 'object') {
    const n = snapshotAnimated(value);
    if (n === undefined) return undefined;
    return cssNumber(key, n);
  }
  if (typeof value === 'number') return cssNumber(key, value);
  return String(value);
}

function pushDecl(decls: string[], cssKey: string, value: unknown): void {
  const v = cssValue(cssKey, value);
  if (v === undefined) return;
  decls.push(`${cssKey}:${v}`);
}

function pushFontFamily(decls: string[], fontFamily: string): void {
  const match = EXPO_FONT_RE.exec(fontFamily);
  if (match?.[1] && match[2]) {
    const family = /^[A-Za-z0-9-]+$/.test(match[1])
      ? match[1]
      : `"${match[1].replace(/"/g, '')}"`;
    decls.push(`font-family:${family}`);
    decls.push(`font-weight:${match[2]}`);
    return;
  }
  const family = /^[A-Za-z0-9-]+$/.test(fontFamily)
    ? fontFamily
    : `"${fontFamily.replace(/"/g, '')}"`;
  decls.push(`font-family:${family}`);
}

const TRANSFORM_PX = new Set(['translateX', 'translateY', 'perspective']);

function transformPiece(t: SxTransform): string | undefined {
  const entry = Object.entries(t)[0];
  if (entry === undefined) return undefined;
  const [key, value] = entry;
  if (TRANSFORM_PX.has(key)) return `${key}(${value}px)`;
  return `${key}(${value})`;
}

function transformToCss(list: readonly SxTransform[]): string {
  return list
    .map(transformPiece)
    .filter((part): part is string => part !== undefined)
    .join(' ');
}

function pointerEventsCss(value: SxProps['pointerEvents']): string | undefined {
  if (value === 'none' || value === 'box-none') return 'none';
  if (value === 'auto') return 'auto';
  return undefined;
}

function pushFillAndInset(props: SxProps, decls: string[]): void {
  if (props.absoluteFill === true) {
    decls.push('position:absolute');
    decls.push('top:0');
    decls.push('right:0');
    decls.push('bottom:0');
    decls.push('left:0');
  }
  if (typeof props.inset === 'number') {
    const v = cssNumber('inset', props.inset);
    decls.push(`top:${v}`, `right:${v}`, `bottom:${v}`, `left:${v}`);
  }
}

function pushScaledSpacing(props: SxProps, decls: string[]): void {
  for (const [from, cssKey] of SPACING_CSS) {
    const v = props[from];
    if (typeof v !== 'number') continue;
    pushDecl(decls, cssKey, resolveSpacing(v));
  }
  for (const [from, a, b] of PAIR_CSS) {
    if (from === 'px' || from === 'py' || from === 'mx' || from === 'my') {
      const v = props[from];
      if (typeof v !== 'number') continue;
      pushDecl(decls, a, resolveSpacing(v));
      continue;
    }
    const raw = props[from];
    if (typeof raw !== 'number') continue;
    pushDecl(decls, a, raw);
    pushDecl(decls, b, raw);
  }
}

function pushDirect(props: SxProps, decls: string[]): void {
  for (const [from, cssKey] of DIRECT_CSS) {
    const v = props[from];
    if (v !== undefined) pushDecl(decls, cssKey, v);
  }
}

function pushColors(
  props: SxProps,
  decls: string[],
  colors: ColorTokens
): void {
  const bg = props.background ?? props.backgroundColor;
  if (bg !== undefined) {
    pushDecl(decls, 'background-color', resolveColor(bg, colors));
  }
  if (props.color !== undefined) {
    pushDecl(decls, 'color', resolveColor(props.color, colors));
  }
  if (props.borderColor !== undefined) {
    pushDecl(decls, 'border-color', resolveColor(props.borderColor, colors));
  }
  if (props.outlineColor !== undefined) {
    pushDecl(decls, 'outline-color', resolveColor(props.outlineColor, colors));
  }
  const sides = [
    ['borderTopColor', 'border-top-color'],
    ['borderRightColor', 'border-right-color'],
    ['borderBottomColor', 'border-bottom-color'],
    ['borderLeftColor', 'border-left-color'],
  ] as const;
  for (const [from, cssKey] of sides) {
    const v = props[from];
    if (v !== undefined) pushDecl(decls, cssKey, resolveColor(v, colors));
  }
}

function pushRadius(props: SxProps, decls: string[]): void {
  const keys = [
    ['borderRadius', 'border-radius'],
    ['borderTopLeftRadius', 'border-top-left-radius'],
    ['borderTopRightRadius', 'border-top-right-radius'],
    ['borderBottomLeftRadius', 'border-bottom-left-radius'],
    ['borderBottomRightRadius', 'border-bottom-right-radius'],
  ] as const;
  for (const [from, cssKey] of keys) {
    const n = resolveRadius(props[from]);
    if (n !== undefined) pushDecl(decls, cssKey, n);
  }
}

function hairlineOrWidth(value: number | 'hairline'): number {
  return value === 'hairline' ? 1 : value;
}

function pushTypeAndMotion(props: SxProps, decls: string[]): void {
  if (props.borderBottomWidth !== undefined) {
    pushDecl(
      decls,
      'border-bottom-width',
      hairlineOrWidth(props.borderBottomWidth)
    );
  }
  if (props.fontSize !== undefined) {
    pushDecl(decls, 'font-size', resolveFontSize(props.fontSize));
  }
  if (props.lineHeight !== undefined) {
    pushDecl(decls, 'line-height', resolveLineHeight(props.lineHeight));
  }
  if (props.fontFamily !== undefined) pushFontFamily(decls, props.fontFamily);
  if (props.opacity !== undefined) {
    const opacity =
      typeof props.opacity === 'number'
        ? props.opacity
        : snapshotAnimated(props.opacity);
    if (opacity !== undefined) decls.push(`opacity:${opacity}`);
  }
  if (props.transform !== undefined) {
    const css = transformToCss(props.transform);
    if (css.length > 0) decls.push(`transform:${css}`);
  }
  const pe = pointerEventsCss(props.pointerEvents);
  if (pe !== undefined) decls.push(`pointer-events:${pe}`);
}

function pushElevationCss(
  props: SxProps,
  decls: string[],
  options: SxCompileOptions
): void {
  if (props.elevation === undefined) return;
  const shadow = options.elevation(props.elevation);
  if (shadow.boxShadow && props.boxShadow === undefined) {
    decls.push(`box-shadow:${shadow.boxShadow}`);
  }
  if (shadow.backgroundColor === undefined) return;
  if (props.background !== undefined || props.backgroundColor !== undefined) {
    return;
  }
  decls.push(`background-color:${shadow.backgroundColor}`);
}

function pushRest(
  props: SxProps,
  decls: string[],
  options: SxCompileOptions
): void {
  pushTypeAndMotion(props, decls);
  pushElevationCss(props, decls, options);
}

export function sxToCss(input: SxInput, options: SxCompileOptions): string {
  const props = flattenSx(input);
  if (props === undefined) return '';
  const decls: string[] = [];
  pushFillAndInset(props, decls);
  pushScaledSpacing(props, decls);
  pushDirect(props, decls);
  pushColors(props, decls, options.colors);
  pushRadius(props, decls);
  pushRest(props, decls, options);
  return decls.join(';');
}
