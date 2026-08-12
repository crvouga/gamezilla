type JsonNode =
  | string
  | {
      type: string | unknown;
      props: Record<string, unknown>;
      children: JsonNode[] | null;
    };

type SerializeCtx = {
  readonly fonts: Set<string>;
};

const EXPO_FONT_RE =
  /^(.+)_(\d{3})(Regular|Medium|SemiBold|Bold|Light|Thin|Black|ExtraBold|ExtraLight)?$/;

const VIEW_DEFAULTS =
  'display:flex;flex-direction:column;align-items:stretch;border-width:0;border-style:solid;box-sizing:border-box';

const BUTTON_RESET =
  'appearance:none;border:none;background:transparent;padding:0;margin:0;font:inherit;color:inherit;text-align:inherit;cursor:pointer';

/**
 * Serialize a React Native Testing Library / react-test-renderer `toJSON()`
 * tree into a readable HTML document for simulation reports.
 */
export function serializeHostTreeHtml(tree: unknown): string {
  const ctx: SerializeCtx = { fonts: new Set() };
  const body = serializeTree(tree, ctx);
  const fontLinks = googleFontLinks([...ctx.fonts]);
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>UI snapshot</title>',
    ...fontLinks,
    '<style>',
    'html,body{margin:0;padding:0;height:100%;background:hsla(0,0%,98%,1);color:#111;}',
    '.rn-root{display:flex;flex-direction:column;min-height:100%;height:100%;box-sizing:border-box;}',
    'input,textarea{font:inherit;}',
    '</style>',
    '</head>',
    `<body><div class="rn-root">${body}</div></body>`,
    '</html>',
  ].join('');
}

function googleFontLinks(families: string[]): string[] {
  if (families.length === 0) return [];
  const links: string[] = [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
  ];
  for (const family of families) {
    const query = encodeURIComponent(family).replace(/%20/g, '+');
    const href = `https://fonts.googleapis.com/css2?family=${query}:wght@400;500;600;700&display=swap`;
    links.push(`<link rel="stylesheet" href="${href}" />`);
  }
  return links;
}

function serializeTree(tree: unknown, ctx: SerializeCtx): string {
  if (tree == null) return '';
  if (Array.isArray(tree)) {
    return tree.map((node) => serializeJson(node as JsonNode, ctx)).join('');
  }
  return serializeJson(tree as JsonNode, ctx);
}

function serializeJson(node: JsonNode, ctx: SerializeCtx): string {
  if (typeof node === 'string') {
    return escapeHtml(node);
  }

  const typeName = hostTypeName(node.type);
  if (typeName === '' || typeName === 'Fragment') {
    return serializeJsonChildren(node.children, ctx);
  }

  const props = node.props ?? {};
  const tag = mapHostTag(typeName, props);
  const attrs = buildAttrs(typeName, props, tag, ctx);
  const childrenHtml = serializeJsonChildren(node.children, ctx);

  if (tag === 'input' || tag === 'img') {
    return `<${tag}${attrs} />`;
  }
  return `<${tag}${attrs}>${childrenHtml}</${tag}>`;
}

function serializeJsonChildren(
  children: JsonNode[] | null,
  ctx: SerializeCtx
): string {
  if (!children || children.length === 0) return '';
  return children.map((child) => serializeJson(child, ctx)).join('');
}

function hostTypeName(type: unknown): string {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') {
    const named = (type as { displayName?: string; name?: string }).displayName;
    if (typeof named === 'string' && named.length > 0) return named;
    if (typeof type.name === 'string' && type.name.length > 0) return type.name;
    return 'Component';
  }
  if (type && typeof type === 'object') {
    const obj = type as { displayName?: string; name?: string };
    if (typeof obj.displayName === 'string' && obj.displayName.length > 0) {
      return obj.displayName;
    }
    if (typeof obj.name === 'string' && obj.name.length > 0) return obj.name;
  }
  return 'Unknown';
}

function mapHostTag(typeName: string, props: Record<string, unknown>): string {
  const role = props['accessibilityRole'];
  if (role === 'button') return 'button';
  if (role === 'link') return 'a';
  if (role === 'heading' || role === 'header') return 'h2';
  if (role === 'textbox') return 'input';
  if (role === 'image') return 'img';

  switch (typeName) {
    case 'Text':
      return 'span';
    case 'TextInput':
      return 'input';
    case 'Image':
      return 'img';
    case 'ScrollView':
    case 'View':
    case 'SafeAreaView':
      return 'div';
    case 'Pressable':
    case 'TouchableOpacity':
    case 'TouchableHighlight':
    case 'TouchableWithoutFeedback':
    case 'Button':
      return 'button';
    default:
      return 'div';
  }
}

function readDataSet(
  props: Record<string, unknown>
): Record<string, string> | undefined {
  const ds = props['dataSet'];
  if (ds == null || typeof ds !== 'object') return undefined;
  return ds as Record<string, string>;
}

function buildAttrs(
  typeName: string,
  props: Record<string, unknown>,
  tag: string,
  ctx: SerializeCtx
): string {
  const dataSet = readDataSet(props);
  const component = dataSet?.['component'] ?? typeName;
  const parts: string[] = [` data-component="${escapeAttr(component)}"`];
  pushStringAttr(parts, 'data-testid', props['testID']);
  pushStringAttr(parts, 'aria-label', props['accessibilityLabel']);
  const role = props['accessibilityRole'];
  if (typeof role === 'string' && role.length > 0 && tag !== 'button') {
    parts.push(` role="${escapeAttr(role)}"`);
  }
  pushStyleAttr({
    parts,
    typeName,
    tag,
    style: props['style'],
    capturedCss: dataSet?.['css'],
    ctx,
  });
  if (tag === 'input') pushInputAttrs(parts, props);
  if (tag === 'img') pushImgAttrs(parts, props);
  return parts.join('');
}

function pushStringAttr(parts: string[], name: string, value: unknown): void {
  if (typeof value === 'string' && value.length > 0) {
    parts.push(` ${name}="${escapeAttr(value)}"`);
  }
}

function pushStyleAttr(args: {
  readonly parts: string[];
  readonly typeName: string;
  readonly tag: string;
  readonly style: unknown;
  readonly capturedCss: string | undefined;
  readonly ctx: SerializeCtx;
}): void {
  const { parts, typeName, tag, style, capturedCss, ctx } = args;
  const styleCss =
    capturedCss !== undefined && capturedCss.length > 0
      ? (collectFontsFromCss(capturedCss, ctx), capturedCss)
      : styleToCss(style, ctx);
  const base = hostBaseCss(typeName, tag);
  let css = base;
  if (styleCss) {
    css = css ? `${css};${styleCss}` : styleCss;
  }
  if (isScrollHost(typeName)) {
    css = css ? `${css};overflow:auto` : 'overflow:auto';
  }
  if (css) {
    parts.push(` style="${escapeAttr(css)}"`);
  }
}

function isScrollHost(typeName: string): boolean {
  return typeName === 'ScrollView' || typeName === 'RCTScrollView';
}

function collectFontsFromCss(css: string, ctx: SerializeCtx): void {
  const re = /font-family:\s*([^;]+)/g;
  let match = re.exec(css);
  while (match) {
    const raw = match[1]?.trim().replace(/^["']|["']$/g, '');
    if (raw) ctx.fonts.add(raw);
    match = re.exec(css);
  }
}

function hostBaseCss(typeName: string, tag: string): string {
  if (tag === 'button') {
    return `${BUTTON_RESET};${VIEW_DEFAULTS}`;
  }
  if (typeName === 'Text') {
    return '';
  }
  if (isViewLike(typeName) || tag === 'div' || tag === 'a' || tag === 'h2') {
    return VIEW_DEFAULTS;
  }
  return '';
}

function isViewLike(typeName: string): boolean {
  return (
    typeName === 'View' ||
    typeName === 'ScrollView' ||
    typeName === 'SafeAreaView' ||
    typeName === 'Pressable' ||
    typeName.startsWith('RNC') ||
    typeName.startsWith('RNSVG')
  );
}

function pushInputAttrs(parts: string[], props: Record<string, unknown>): void {
  const value = props['value'];
  if (typeof value === 'string' || typeof value === 'number') {
    parts.push(` value="${escapeAttr(String(value))}"`);
  }
  pushStringAttr(parts, 'placeholder', props['placeholder']);
  parts.push(' readonly');
}

function pushImgAttrs(parts: string[], props: Record<string, unknown>): void {
  const source = props['source'] as { uri?: string } | number | undefined;
  if (source && typeof source === 'object' && typeof source.uri === 'string') {
    parts.push(` src="${escapeAttr(source.uri)}"`);
  } else {
    parts.push(' alt=""');
  }
}

const SKIP_RN_CSS = new Set([
  'includeFontPadding',
  'textAlignVertical',
  'elevation',
  'shadowOpacity',
  'shadowRadius',
  'shadowColor',
  'shadowOffset',
]);

function styleToCss(style: unknown, ctx: SerializeCtx): string {
  if (style == null) return '';
  const flat = expandRnShorthands(flattenStyle(style));
  const decls: string[] = [];
  for (const [key, value] of Object.entries(flat)) {
    if (value == null || typeof value === 'object') continue;
    if (SKIP_RN_CSS.has(key)) continue;
    if (key === 'fontFamily' && typeof value === 'string') {
      pushFontDecls(decls, value, ctx);
      continue;
    }
    if (key === 'pointerEvents' && value === 'box-none') {
      decls.push('pointer-events:none');
      continue;
    }
    const cssKey = camelToKebab(key);
    decls.push(`${cssKey}:${cssValue(key, value)}`);
  }
  return decls.join(';');
}

function pushFontDecls(
  decls: string[],
  fontFamily: string,
  ctx: SerializeCtx
): void {
  const parsed = parseExpoFont(fontFamily);
  if (parsed) {
    ctx.fonts.add(parsed.family);
    decls.push(`font-family:${cssFontFamily(parsed.family)}`);
    decls.push(`font-weight:${parsed.weight}`);
    return;
  }
  decls.push(`font-family:${cssFontFamily(fontFamily)}`);
}

function cssFontFamily(name: string): string {
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

const UNITLESS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'fontWeight',
  'aspectRatio',
]);

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
