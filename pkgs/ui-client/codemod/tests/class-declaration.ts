/**
 * Test-only oracle helper: resolve an emitted Tailwind class back to its
 * exact CSS declarations.
 *
 * The style-equivalence property works as: generate arbitrary `SxProps` →
 * `sxToCss` (runtime truth) vs `mapSxRecord` → classes → this resolver.
 * Both declaration multisets must match. Any mapping/inverter drift fails
 * loudly here instead of shipping a visual regression.
 */

import { COLOR_PALETTE } from '@pkgs/ui-shared/color-palette';
import { fontSize } from '@pkgs/ui-shared/scale';
import { tokenToKebab } from '../sx-map-color';

const TOKEN_KEBABS = new Set(
  Object.keys(COLOR_PALETTE.light).map((t) => tokenToKebab(t))
);

const FONT_PX: Readonly<Record<string, number>> = {
  ...(fontSize as Record<string, number>),
};

const FONT_WEIGHT_N: Readonly<Record<string, string>> = {
  'font-thin': '100',
  'font-extralight': '200',
  'font-light': '300',
  'font-normal': '400',
  'font-medium': '500',
  'font-semibold': '600',
  'font-bold': '700',
  'font-extrabold': '800',
  'font-black': '900',
};

const SINGLE: Readonly<Record<string, string>> = {
  hidden: 'display:none',
  flex: 'display:flex',
  block: 'display:block',
  inline: 'display:inline',
  'inline-flex': 'display:inline-flex',
  grid: 'display:grid',
  contents: 'display:contents',
  'flex-row': 'flex-direction:row',
  'flex-col': 'flex-direction:column',
  'flex-row-reverse': 'flex-direction:row-reverse',
  'flex-col-reverse': 'flex-direction:column-reverse',
  'flex-wrap': 'flex-wrap:wrap',
  'flex-nowrap': 'flex-wrap:nowrap',
  'flex-wrap-reverse': 'flex-wrap:wrap-reverse',
  'items-start': 'align-items:flex-start',
  'items-end': 'align-items:flex-end',
  'items-center': 'align-items:center',
  'items-stretch': 'align-items:stretch',
  'items-baseline': 'align-items:baseline',
  'self-auto': 'align-self:auto',
  'self-start': 'align-self:flex-start',
  'self-end': 'align-self:flex-end',
  'self-center': 'align-self:center',
  'self-stretch': 'align-self:stretch',
  'self-baseline': 'align-self:baseline',
  'content-start': 'align-content:flex-start',
  'content-end': 'align-content:flex-end',
  'content-center': 'align-content:center',
  'content-stretch': 'align-content:stretch',
  'content-baseline': 'align-content:baseline',
  'content-between': 'align-content:space-between',
  'content-around': 'align-content:space-around',
  'content-evenly': 'align-content:space-evenly',
  'justify-start': 'justify-content:flex-start',
  'justify-end': 'justify-content:flex-end',
  'justify-center': 'justify-content:center',
  'justify-between': 'justify-content:space-between',
  'justify-around': 'justify-content:space-around',
  'justify-evenly': 'justify-content:space-evenly',
  'overflow-visible': 'overflow:visible',
  'overflow-hidden': 'overflow:hidden',
  'overflow-scroll': 'overflow:scroll',
  'overflow-x-visible': 'overflow-x:visible',
  'overflow-x-hidden': 'overflow-x:hidden',
  'overflow-x-scroll': 'overflow-x:scroll',
  'overflow-y-visible': 'overflow-y:visible',
  'overflow-y-hidden': 'overflow-y:hidden',
  'overflow-y-scroll': 'overflow-y:scroll',
  absolute: 'position:absolute',
  relative: 'position:relative',
  static: 'position:static',
  fixed: 'position:fixed',
  visible: 'visibility:visible',
  invisible: 'visibility:hidden',
  'pointer-events-none': 'pointer-events:none',
  'pointer-events-auto': 'pointer-events:auto',
  'flex-1': 'flex:1 1 0%',
  grow: 'flex-grow:1',
  'grow-0': 'flex-grow:0',
  shrink: 'flex-shrink:1',
  'shrink-0': 'flex-shrink:0',
  'rounded-none': 'border-radius:0',
  'rounded-tl-none': 'border-top-left-radius:0',
  'rounded-tr-none': 'border-top-right-radius:0',
  'rounded-bl-none': 'border-bottom-left-radius:0',
  'rounded-br-none': 'border-bottom-right-radius:0',
  italic: 'font-style:italic',
  'not-italic': 'font-style:normal',
  'text-left': 'text-align:left',
  'text-right': 'text-align:right',
  'text-center': 'text-align:center',
  'text-justify': 'text-align:justify',
  'normal-case': 'text-transform:none',
  uppercase: 'text-transform:uppercase',
  lowercase: 'text-transform:lowercase',
  capitalize: 'text-transform:capitalize',
  'select-auto': 'user-select:auto',
  'select-none': 'user-select:none',
  'select-text': 'user-select:text',
  'select-all': 'user-select:all',
  'whitespace-normal': 'white-space:normal',
  'whitespace-nowrap': 'white-space:nowrap',
  'whitespace-pre': 'white-space:pre',
  'whitespace-pre-wrap': 'white-space:pre-wrap',
  'whitespace-pre-line': 'white-space:pre-line',
  'text-clip': 'text-overflow:clip',
  'text-ellipsis': 'text-overflow:ellipsis',
  underline: 'text-decoration-line:underline',
  'line-through': 'text-decoration-line:line-through',
  'no-underline': 'text-decoration-line:none',
  border: 'border-width:1px',
  'border-0': 'border-width:0',
  'border-t': 'border-top-width:1px',
  'border-t-0': 'border-top-width:0',
  'border-r': 'border-right-width:1px',
  'border-r-0': 'border-right-width:0',
  'border-b': 'border-bottom-width:1px',
  'border-b-0': 'border-bottom-width:0',
  'border-l': 'border-left-width:1px',
  'border-l-0': 'border-left-width:0',
  'border-solid': 'border-style:solid',
  'border-dotted': 'border-style:dotted',
  'border-dashed': 'border-style:dashed',
  'w-auto': 'width:auto',
  'h-auto': 'height:auto',
};

const SPACING_PREFIX: Readonly<Record<string, readonly string[]>> = {
  p: ['padding'],
  px: ['padding-left', 'padding-right'],
  py: ['padding-top', 'padding-bottom'],
  pt: ['padding-top'],
  pb: ['padding-bottom'],
  pl: ['padding-left'],
  pr: ['padding-right'],
  m: ['margin'],
  mx: ['margin-left', 'margin-right'],
  my: ['margin-top', 'margin-bottom'],
  mt: ['margin-top'],
  mb: ['margin-bottom'],
  ml: ['margin-left'],
  mr: ['margin-right'],
  gap: ['gap'],
  'gap-x': ['column-gap'],
  'gap-y': ['row-gap'],
};

function pxOf(n: number): string {
  return n === 0 ? '0' : `${n}px`;
}

const BORDER_SIDE: Readonly<Record<string, string>> = {
  t: 'top',
  r: 'right',
  b: 'bottom',
  l: 'left',
  'border-t': 'top',
  'border-r': 'right',
  'border-b': 'bottom',
  'border-l': 'left',
};

const KEYWORD_PROP: Readonly<Record<string, string>> = {
  bg: 'background-color',
  text: 'color',
  border: 'border-color',
  outline: 'outline-color',
};

function borderSideColor(side: string, token: string): string {
  return `border-${BORDER_SIDE[side] ?? side}-color:var(--ui-color-${token})`;
}

/** Resolve one class to declarations; throws on unknown shapes (drift alarm). */
export function classToDeclarations(className: string): string[] {
  const single = SINGLE[className];
  if (single !== undefined) return [single];
  if (className.startsWith('[') && className.endsWith(']')) {
    return className
      .slice(1, -1)
      .split(';')
      .map((d) => d.replace(/_/g, ' '));
  }
  const fromSpacing = spacingDeclarations(className);
  if (fromSpacing !== undefined) return fromSpacing;
  const fromFont = fontDeclarations(className);
  if (fromFont !== undefined) return fromFont;
  const fromColor = colorDeclarations(className);
  if (fromColor !== undefined) return fromColor;
  const fromMisc = miscDeclarations(className);
  if (fromMisc !== undefined) return fromMisc;
  throw new Error(`class-declaration drift: no resolution for ${className}`);
}

function spacingDeclarations(className: string): string[] | undefined {
  const spaced = /^([a-z]+(?:-[xy])?)-(-?\d+(?:\.\d+)?)$/.exec(className);
  if (spaced === null) return undefined;
  const decls = SPACING_PREFIX[spaced[1] ?? ''];
  if (decls === undefined) return undefined;
  const value = pxOf(Number(spaced[2]) * 4);
  return decls.map((d) => `${d}:${value}`);
}

function fontDeclarations(className: string): string[] | undefined {
  const fontSizeName = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/.exec(className);
  if (fontSizeName !== null) {
    const key = fontSizeName[1] ?? '';
    return [`font-size:${pxOf(FONT_PX[key] ?? 0)}`];
  }
  const weight = FONT_WEIGHT_N[className];
  if (weight !== undefined) return [`font-weight:${weight}`];
  return undefined;
}

function colorDeclarations(className: string): string[] | undefined {
  if (className.startsWith('text-')) {
    const token = className.slice('text-'.length);
    if (TOKEN_KEBABS.has(token)) return [`color:var(--ui-color-${token})`];
  }
  if (className.startsWith('bg-')) {
    const token = className.slice('bg-'.length);
    if (TOKEN_KEBABS.has(token)) {
      return [`background-color:var(--ui-color-${token})`];
    }
    const elevation = /^elevation-([1-5])$/.exec(token);
    if (elevation !== null) {
      return [`background-color:var(--ui-elevation-${elevation[1]})`];
    }
  }
  if (className.startsWith('border-')) {
    const token = className.slice('border-'.length);
    if (TOKEN_KEBABS.has(token)) {
      return [`border-color:var(--ui-color-${token})`];
    }
  }
  const borderSide = /^border-([trbl])-([\w-]+)$/.exec(className);
  if (borderSide !== null && TOKEN_KEBABS.has(borderSide[2] ?? '')) {
    return [borderSideColor(borderSide[1] ?? '', borderSide[2] ?? '')];
  }
  if (className.startsWith('outline-')) {
    const token = className.slice('outline-'.length);
    if (TOKEN_KEBABS.has(token)) {
      return [`outline-color:var(--ui-color-${token})`];
    }
  }
  return keywordDeclarations(className);
}

function keywordDeclarations(className: string): string[] | undefined {
  const keyword =
    /^(bg|text|border|border-[trbl]|outline)-(transparent|inherit|current)$/.exec(
      className
    );
  if (keyword === null) return undefined;
  const scope = keyword[1] ?? '';
  const prop =
    KEYWORD_PROP[scope] ?? `border-${BORDER_SIDE[scope] ?? scope}-color`;
  const value = keyword[2] === 'current' ? 'currentcolor' : (keyword[2] ?? '');
  return [`${prop}:${value}`];
}

function miscDeclarations(className: string): string[] | undefined {
  const opacity = /^opacity-(\d+(?:\.\d+)?)$/.exec(className);
  if (opacity !== null) return [`opacity:${Number(opacity[1]) / 100}`];
  const zIndex = /^(-?)z-(\d+)$/.exec(className);
  if (zIndex !== null) {
    const n = Number(zIndex[2]);
    return [`z-index:${zIndex[1] === '-' ? 0 - n : n}`];
  }
  const clamp = /^line-clamp-(\d+)$/.exec(className);
  if (clamp !== null) {
    return [
      'display:-webkit-box',
      '-webkit-box-orient:vertical',
      `-webkit-line-clamp:${clamp[1]}`,
      'overflow:hidden',
    ];
  }
  if (className === 'inset-0') {
    return ['top:0', 'right:0', 'bottom:0', 'left:0'];
  }
  const cursor = /^cursor-([\w-]+)$/.exec(className);
  if (cursor !== null) return [`cursor:${cursor[1]}`];
  return undefined;
}

const ROUNDED_PROP: Readonly<Record<string, string>> = {
  rounded: 'border-radius',
  'rounded-tl': 'border-top-left-radius',
  'rounded-tr': 'border-top-right-radius',
  'rounded-bl': 'border-bottom-left-radius',
  'rounded-br': 'border-bottom-right-radius',
};

const DIMENSION_PROP: Readonly<Record<string, string>> = {
  w: 'width',
  h: 'height',
  'min-w': 'min-width',
  'max-w': 'max-width',
  'min-h': 'min-height',
  'max-h': 'max-height',
  basis: 'flex-basis',
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
  start: 'inset-inline-start',
  end: 'inset-inline-end',
  inset: 'inset',
  tracking: 'letter-spacing',
  aspect: 'aspect-ratio',
  m: 'margin',
  mx: 'margin-x',
  my: 'margin-y',
  mt: 'margin-top',
  mb: 'margin-bottom',
  ml: 'margin-left',
  mr: 'margin-right',
  p: 'padding',
  px: 'padding-x',
  py: 'padding-y',
  pt: 'padding-top',
  pb: 'padding-bottom',
  pl: 'padding-left',
  pr: 'padding-right',
  col: 'grid-column',
  row: 'grid-row',
  'grid-cols': 'grid-template-columns',
  'grid-rows': 'grid-template-rows',
  ps: 'padding-inline-start',
  pe: 'padding-inline-end',
  ms: 'margin-inline-start',
  me: 'margin-inline-end',
};

const PAIR_EXPANSION: Readonly<Record<string, readonly [string, string]>> = {
  'margin-x': ['margin-left', 'margin-right'],
  'margin-y': ['margin-top', 'margin-bottom'],
  'padding-x': ['padding-left', 'padding-right'],
  'padding-y': ['padding-top', 'padding-bottom'],
};

const ARBITRARY_COLOR_PROP: Readonly<Record<string, string>> = {
  bg: 'background-color',
  border: 'border-color',
  'border-t': 'border-top-color',
  'border-r': 'border-right-color',
  'border-b': 'border-bottom-color',
  'border-l': 'border-left-color',
  outline: 'outline-color',
};

/** Radius/size arbitrary utilities the table emits (`rounded-[10px]`…). */
export function sizeClassToDeclarations(className: string): string[] {
  const rounded = /^(rounded(?:-[trbl]{1,2})?)-\[(.+)\]$/.exec(className);
  if (rounded !== null) {
    const side = ROUNDED_PROP[rounded[1] ?? ''] ?? 'border-radius';
    return [`${side}:${(rounded[2] ?? '').replace(/_/g, ' ')}`];
  }
  const dimension =
    /^(w|h|min-w|max-w|min-h|max-h|basis|top|right|bottom|left|start|end|inset|ps|pe|ms|me|pt|pb|pl|pr|px|py|p|mt|mb|ml|mr|mx|my|m|gap|tracking|aspect|origin|col|row|grid-cols|grid-rows)-\[(.+)\]$/.exec(
      className
    );
  if (dimension !== null) {
    return dimensionToDeclarations(dimension[1] ?? '', dimension[2] ?? '');
  }
  const textSize = /^text-\[(.+)\]$/.exec(className);
  if (textSize !== null) {
    const value = (textSize[1] ?? '').replace(/_/g, ' ');
    if (/^-?[\d.]+px$/.test(value)) return [`font-size:${value}`];
    return [`color:${value}`];
  }
  const arbitraryColor = /^(bg|border|border-[trbl]|outline)-\[(.+)\]$/.exec(
    className
  );
  if (arbitraryColor !== null) {
    const prop =
      ARBITRARY_COLOR_PROP[arbitraryColor[1] ?? ''] ?? 'background-color';
    const value = (arbitraryColor[2] ?? '').replace(/_/g, ' ');
    return [`${prop}:${value}`];
  }
  const leading = /^leading-\[(.+)\]$/.exec(className);
  if (leading !== null) return [`line-height:${leading[1]}`];
  throw new Error(
    `class-declaration drift: no size resolution for ${className}`
  );
}

function dimensionToDeclarations(prefix: string, rawValue: string): string[] {
  const value = rawValue.replace(/_/g, ' ');
  const prop = DIMENSION_PROP[prefix] ?? prefix;
  if (prop === 'inset') {
    return [
      `top:${value}`,
      `right:${value}`,
      `bottom:${value}`,
      `left:${value}`,
    ];
  }
  const pair = PAIR_EXPANSION[prop];
  if (pair !== undefined) {
    return [`${pair[0]}:${value}`, `${pair[1]}:${value}`];
  }
  return [`${prop}:${value}`];
}

/** Resolve any emitted class (utilities + arbitrary sizes + properties). */
export function resolveClass(className: string): string[] {
  try {
    return classToDeclarations(className);
  } catch {
    return sizeClassToDeclarations(className);
  }
}

export function tokenKebabs(): Set<string> {
  return new Set(TOKEN_KEBABS);
}
