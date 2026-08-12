import {
  isRnScreenStackHost,
  shouldHideRnScreen,
  topRnScreenIndex,
  withRnScreenHiddenCss,
} from './serialize-rn-screen';
import {
  isRnsvgHost,
  isSvgGeometryTag,
  mapRnsvgTag,
  pushRnsvgAttrs,
} from './serialize-rnsvg';
import {
  collectFontsFromCss,
  rewriteFlexZero,
  stripBrokenTransform,
  styleToCss,
} from './serialize-style-css';

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

type SerializeNodeOpts = {
  /** Covered by a later RNSScreen in the same RNSScreenStack. */
  readonly coveredByStack?: boolean;
};

/**
 * Yoga / react-native-web View defaults the browser does not apply.
 * Mirrors RN-web `view$raw` (minus z-index / list-style noise that fight
 * stacking and HTML semantics in reports).
 */
const VIEW_DEFAULTS =
  'display:flex;flex-direction:column;align-content:flex-start;align-items:stretch;flex-basis:auto;flex-shrink:0;position:relative;min-height:0;min-width:0;margin:0;padding:0;border:0 solid black;box-sizing:border-box;background-color:transparent';

/** SVG roots skip VIEW_DEFAULTS; keep size under column flex parents. */
const SVG_ROOT_DEFAULTS = 'display:block;overflow:visible;flex-shrink:0';

const BUTTON_RESET =
  'appearance:none;border:none;background:transparent;padding:0;margin:0;font:inherit;color:inherit;text-align:inherit;cursor:pointer';

/** Dark app chrome (matches `@pkgs/ui` dark palette surfaces / text). */
const SNAPSHOT_BG = 'hsla(240, 5%, 4%, 1)';
const SNAPSHOT_FG = 'hsla(0, 0%, 98%, 1)';
const BODY_FONT =
  "Nunito, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Serialize a React Native Testing Library / react-test-renderer `toJSON()`
 * tree into a readable HTML document for simulation reports.
 */
export type SerializeHostTreeHtmlOptions = {
  /**
   * When set, shell chrome CSS is linked instead of inlined (smaller frames
   * in multi-snapshot reports). Standalone callers omit this.
   */
  readonly stylesheetHref?: string;
};

/** Shell CSS shared by report frames when using `stylesheetHref`. */
export const SNAPSHOT_SHELL_CSS = [
  `html,body,.rn-root{width:100%;height:100%;margin:0;padding:0;overflow:hidden;position:relative;color-scheme:dark;background:${SNAPSHOT_BG};color:${SNAPSHOT_FG};font-family:${BODY_FONT};}`,
  '*{box-sizing:border-box;-webkit-user-select:none;user-select:none;}',
  "input,textarea,[contenteditable='true']{-webkit-user-select:text;user-select:text;}",
  '.rn-root{display:flex;flex-direction:column;flex:1;min-height:100%;box-sizing:border-box;}',
  'input,textarea,button,span{font:inherit;color:inherit;}',
].join('');
export function serializeHostTreeHtml(
  tree: unknown,
  options: SerializeHostTreeHtmlOptions = {}
): string {
  const ctx: SerializeCtx = { fonts: new Set(['Nunito']) };
  const body = serializeTree(tree, ctx);
  const fontLinks = googleFontLinks([...ctx.fonts]);
  const styleBlock =
    options.stylesheetHref !== undefined
      ? `<link rel="stylesheet" href="${escapeHtml(options.stylesheetHref)}" />`
      : `<style>${SNAPSHOT_SHELL_CSS}</style>`;
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="dark" />',
    '<title>UI snapshot</title>',
    ...fontLinks,
    styleBlock,
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

function serializeJson(
  node: JsonNode,
  ctx: SerializeCtx,
  opts: SerializeNodeOpts = {}
): string {
  if (typeof node === 'string') {
    return escapeHtml(node);
  }

  const typeName = hostTypeName(node.type);
  if (typeName === '' || typeName === 'Fragment') {
    return serializeJsonChildren(node.children, ctx);
  }

  const props = node.props ?? {};
  const tag = mapHostTag(typeName, props);
  const hideScreen = shouldHideRnScreen(
    typeName,
    props,
    opts.coveredByStack === true
  );
  const attrs = buildAttrs({ typeName, props, tag, ctx, hideScreen });
  const childrenHtml = isRnScreenStackHost(typeName)
    ? serializeScreenStackChildren(node.children, ctx)
    : serializeJsonChildren(node.children, ctx);

  if (
    tag === 'input' ||
    tag === 'img' ||
    ((tag === 'path' || tag === 'circle' || tag === 'rect') &&
      childrenHtml.length === 0)
  ) {
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

function serializeScreenStackChildren(
  children: JsonNode[] | null,
  ctx: SerializeCtx
): string {
  if (!children || children.length === 0) return '';
  const top = topRnScreenIndex(children);
  return children
    .map((child, index) =>
      serializeJson(child, ctx, {
        coveredByStack:
          top !== null &&
          typeof child !== 'string' &&
          child.type === 'RNSScreen' &&
          index !== top,
      })
    )
    .join('');
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
  const svgTag = mapRnsvgTag(typeName);
  if (svgTag !== null) return svgTag;

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

function buildAttrs(args: {
  readonly typeName: string;
  readonly props: Record<string, unknown>;
  readonly tag: string;
  readonly ctx: SerializeCtx;
  readonly hideScreen: boolean;
}): string {
  const { typeName, props, tag, ctx, hideScreen } = args;
  const dataSet = readDataSet(props);
  const component = dataSet?.['component'] ?? typeName;
  const parts: string[] = [` data-component="${escapeAttr(component)}"`];
  pushStringAttr(parts, 'data-src', dataSet?.['src']);
  pushStringAttr(parts, 'data-testid', props['testID']);
  pushStringAttr(parts, 'aria-label', props['accessibilityLabel']);
  if (hideScreen) {
    parts.push(' aria-hidden="true"');
  }
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
    hideScreen,
  });
  if (isRnsvgHost(typeName)) {
    pushRnsvgAttrs(parts, typeName, props, escapeAttr);
  }
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
  readonly hideScreen: boolean;
}): void {
  const { parts, typeName, tag, style, capturedCss, ctx, hideScreen } = args;
  let styleCss =
    capturedCss !== undefined && capturedCss.length > 0
      ? (collectFontsFromCss(capturedCss, ctx), capturedCss)
      : styleToCss(style, ctx);
  // Animated transforms in dataSet.css stringify as `[object Object]`.
  if (styleCss.includes('[object Object]')) {
    styleCss = stripBrokenTransform(styleCss);
    const fromStyle = styleToCss(style, ctx);
    if (fromStyle.length > 0) {
      styleCss = styleCss ? `${styleCss};${fromStyle}` : fromStyle;
    }
  }
  styleCss = rewriteFlexZero(styleCss);
  const base = hostBaseCss(typeName, tag);
  let css = base;
  if (styleCss) {
    css = css ? `${css};${styleCss}` : styleCss;
  }
  if (isScrollHost(typeName)) {
    css = css ? `${css};overflow:auto` : 'overflow:auto';
  }
  css = withRnScreenHiddenCss(css, hideScreen);
  if (css) {
    parts.push(` style="${escapeAttr(css)}"`);
  }
}

function isScrollHost(typeName: string): boolean {
  return typeName === 'ScrollView' || typeName === 'RCTScrollView';
}

function hostBaseCss(typeName: string, tag: string): string {
  if (tag === 'svg') {
    return SVG_ROOT_DEFAULTS;
  }
  if (isSvgGeometryTag(tag)) {
    return '';
  }
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
    typeName.startsWith('RNC')
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
