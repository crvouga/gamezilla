const EXPO_FONT_RE =
  /^(.+)_(\d{3})(Regular|Medium|SemiBold|Bold|Light|Thin|Black|ExtraBold|ExtraLight)?$/;

const SKIP_RN_CSS = new Set([
  'includeFontPadding',
  'textAlignVertical',
  'elevation',
  'shadowOpacity',
  'shadowRadius',
  'shadowColor',
  'shadowOffset',
]);

const UNITLESS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'fontWeight',
  'aspectRatio',
]);

export type StyleSerializeFonts = {
  readonly fonts: Set<string>;
};

export function styleToCss(style: unknown, ctx: StyleSerializeFonts): string {
  if (style == null) return '';
  const flat = expandRnShorthands(flattenStyle(style));
  const decls: string[] = [];
  for (const [key, value] of Object.entries(flat)) {
    pushStyleDecl(decls, key, value, ctx);
  }
  return decls.join(';');
}

export function collectFontsFromCss(
  css: string,
  ctx: StyleSerializeFonts
): void {
  const re = /font-family:\s*([^;]+)/g;
  let match = re.exec(css);
  while (match) {
    const raw = match[1]?.trim().replace(/^["']|["']$/g, '');
    if (raw) ctx.fonts.add(raw);
    match = re.exec(css);
  }
}

/** RN `flex:0`/`-1` → CSS `0 1 auto` (see styleToCss / sxToCss). */
export function rewriteFlexZero(css: string): string {
  if (!css.includes('flex:')) return css;
  return css
    .split(';')
    .map((part) => {
      const trimmed = part.trim();
      if (/^flex:\s*(?:0|-1)$/.test(trimmed)) return 'flex:0 1 auto';
      if (/^flex:\s*none$/.test(trimmed)) return 'flex:0 1 auto';
      return trimmed;
    })
    .filter((part) => part.length > 0)
    .join(';');
}

export function stripBrokenTransform(css: string): string {
  return css
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.includes('[object Object]'))
    .join(';');
}

/** Absolute-fill hosts need explicit 100% sizing in static HTML snapshots. */
export function ensureAbsoluteFillSizing(css: string): string {
  if (!css.includes('position:absolute')) return css;
  if (!/top:\s*0/.test(css) || !/bottom:\s*0/.test(css)) return css;
  const parts = css
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const hasWidth = parts.some((part) => part.startsWith('width:'));
  const hasHeight = parts.some((part) => part.startsWith('height:'));
  if (!hasWidth) parts.push('width:100%');
  if (!hasHeight) parts.push('height:100%');
  return parts.join(';');
}

function pushStyleDecl(
  decls: string[],
  key: string,
  value: unknown,
  ctx: StyleSerializeFonts
): void {
  if (value == null || SKIP_RN_CSS.has(key)) return;
  if (key === 'transform' && Array.isArray(value)) {
    const transformCss = rnTransformToCss(value);
    if (transformCss) decls.push(`transform:${transformCss}`);
    return;
  }
  if (typeof value === 'object') return;
  if (key === 'fontFamily' && typeof value === 'string') {
    pushFontDecls(decls, value, ctx);
    return;
  }
  if (key === 'pointerEvents' && value === 'box-none') {
    decls.push('pointer-events:none');
    return;
  }
  if (isRnFlexZero(key, value)) {
    decls.push('flex:0 1 auto');
    return;
  }
  decls.push(`${camelToKebab(key)}:${cssValue(key, value)}`);
}

function isRnFlexZero(key: string, value: unknown): boolean {
  return (
    key === 'flex' &&
    (value === 0 || value === '0' || value === -1 || value === '-1')
  );
}

function rnTransformToCss(list: unknown[]): string {
  const parts: string[] = [];
  for (const entry of list) {
    if (entry == null || typeof entry !== 'object') continue;
    for (const [op, raw] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof raw === 'string' || typeof raw === 'number') {
        parts.push(`${op}(${raw})`);
      }
    }
  }
  return parts.join(' ');
}

/**
 * RN Platform.select font names that are not real CSS families in Chromium
 * (sim report iframes). Map to Nunito so titles do not fall back to Times.
 */
const PLATFORM_FONT_TO_NUNITO: Record<string, string> = {
  'ui-rounded': '700',
  'sans-serif-medium': '500',
  'ui-serif': '400',
  'ui-monospace': '400',
  /** RN default placeholder — invalid as a CSS family; browsers use Times. */
  normal: '400',
};

function pushFontDecls(
  decls: string[],
  fontFamily: string,
  ctx: StyleSerializeFonts
): void {
  const parsed = parseExpoFont(fontFamily);
  if (parsed) {
    ctx.fonts.add(parsed.family);
    decls.push(`font-family:${cssFontFamily(parsed.family)}`);
    decls.push(`font-weight:${parsed.weight}`);
    return;
  }
  const platformWeight = PLATFORM_FONT_TO_NUNITO[fontFamily];
  if (platformWeight !== undefined) {
    ctx.fonts.add('Nunito');
    decls.push('font-family:Nunito');
    decls.push(`font-weight:${platformWeight}`);
    return;
  }
  decls.push(`font-family:${cssFontFamily(fontFamily)}`);
}

function cssFontFamily(name: string): string {
  return name.split(',').map(quoteCssFamilyName).join(',');
}

function quoteCssFamilyName(part: string): string {
  const name = part.trim();
  if (/^[A-Za-z0-9-]+$/.test(name)) return name;
  return `"${name.replace(/"/g, '')}"`;
}

function parseExpoFont(
  fontFamily: string
): { family: string; weight: string } | null {
  const match = EXPO_FONT_RE.exec(fontFamily);
  if (!match) return null;
  const family = match[1];
  const weight = match[2];
  if (!family || !weight) return null;
  return { family, weight };
}

function expandRnShorthands(
  style: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...style };
  expandPair(out, 'paddingHorizontal', 'paddingLeft', 'paddingRight');
  expandPair(out, 'paddingVertical', 'paddingTop', 'paddingBottom');
  expandPair(out, 'marginHorizontal', 'marginLeft', 'marginRight');
  expandPair(out, 'marginVertical', 'marginTop', 'marginBottom');
  return out;
}

function expandPair(
  style: Record<string, unknown>,
  shorthand: string,
  a: string,
  b: string
): void {
  if (!(shorthand in style)) return;
  const value = style[shorthand];
  delete style[shorthand];
  if (!(a in style)) style[a] = value;
  if (!(b in style)) style[b] = value;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const list = Array.isArray(style) ? style.flat(8) : [style];
  for (const entry of list) {
    if (entry == null || typeof entry !== 'object') continue;
    Object.assign(out, entry as Record<string, unknown>);
  }
  return out;
}

function cssValue(key: string, value: unknown): string {
  if (typeof value === 'number') {
    if (UNITLESS.has(key) || value === 0) return String(value);
    return `${value}px`;
  }
  return String(value);
}

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
