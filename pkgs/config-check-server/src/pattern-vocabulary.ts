/**
 * The words the pattern pass refuses, kept apart from the lint presets on
 * purpose: `check:patterns` is the second, independent reading of a package,
 * so it shares no list with `@pkgs/config-lint-server`. Weakening one leaves
 * the other standing.
 */

/** JSX attributes that style, on any element or component. */
export const STYLE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'class',
  'className',
  'classList',
  'style',
  'sx',
  'css',
  'tw',
]);

/** Module specifiers that are stylesheets. */
export const STYLE_IMPORT = /\.(css|scss|sass|less|styl|pcss)(\?.*)?$/;

/** Tagged templates and calls that write CSS in JavaScript. */
export const CSS_IN_JS_TAGS: ReadonlySet<string> = new Set([
  'css',
  'styled',
  'keyframes',
  'injectGlobal',
  'createGlobalStyle',
  'tw',
  'cva',
  'cx',
  'clsx',
  'twMerge',
]);

/** Browser globals. Focus, scroll, measuring and storage are design-system or port APIs. */
export const PLATFORM_GLOBALS: ReadonlySet<string> = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'matchMedia',
  'ResizeObserver',
  'IntersectionObserver',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'history',
  'location',
  'screen',
  'visualViewport',
  'alert',
  'confirm',
  'prompt',
  'customElements',
  'HTMLElement',
  'Element',
  'CSS',
  'CSSStyleSheet',
  'DOMParser',
  'Image',
]);

/** Objects whose members are the globals above (`globalThis.document`). */
export const GLOBAL_OBJECTS: ReadonlySet<string> = new Set([
  'globalThis',
  'self',
  'window',
]);

/** Platform modules only `pkgs/` may load. */
export const PLATFORM_IMPORT = /^solid-js\/(web|html|h|universal)(\/|$)/;

/** Third-party UI, icon, styling and animation libraries. */
export const THIRD_PARTY_UI =
  /^(lucide(-[a-z]+)?|solid-icons|@tabler\/|@heroicons\/|@phosphor-icons\/|@iconify\/|@fortawesome\/|@kobalte\/|@ark-ui\/|@corvu\/|corvu|@headlessui\/|@radix-ui\/|@mui\/|@chakra-ui\/|@mantine\/|antd|@ant-design\/|@suid\/|@hope-ui\/|solid-headless|solid-ui|@floating-ui\/|@popperjs\/|tippy\.js|@tanstack\/[a-z]+-virtual|@tanstack\/[a-z]+-table|virtua|tailwindcss|@tailwindcss\/|tailwind-merge|tailwind-variants|clsx|classnames|class-variance-authority|@stitches\/|@emotion\/|styled-components|@vanilla-extract\/|@pandacss\/|@macaron-css\/|goober|twin\.macro|unocss|@unocss\/|motion|motion-one|@motionone\/|framer-motion|solid-motionone|solid-transition-group|@solid-primitives\/|gsap|animejs|lottie-web|@lottiefiles\/|popmotion|@formkit\/auto-animate|prosemirror-[a-z-]+|@tiptap\/|@codemirror\/|codemirror|monaco-editor|quill|slate|@dicebear\/|chart\.js|d3(-[a-z-]+)?|recharts|echarts|apexcharts|@shadcn\/|sonner|solid-toast|solid-sonner|swiper|embla-carousel[a-z-]*|html2canvas|canvas-confetti)(\/|$)/;

/** A workspace specifier that reaches past a package's exports. */
export const DEEP_WORKSPACE_IMPORT =
  /^@(apps|libs|pkgs)\/[^/]+\/(src|tests|scripts|dist|node_modules)(\/|$)/;

/** Comments that switch a check off. None of them is honored anywhere. */
export const SUPPRESSION =
  /(eslint-(disable|enable)|oxlint-(disable|enable)|tsgolint-disable|biome-ignore|@ts-ignore|@ts-expect-error|@ts-nocheck|prettier-ignore|stylelint-(disable|enable)|istanbul ignore|c8 ignore|v8 ignore)/;

const NUMBER = String.raw`-?(?:\d+|\d*\.\d+)`;

/** `12px`, `1.5rem`, `-2em`, `100vh`. */
export const LENGTH = new RegExp(
  `^${NUMBER}(px|rem|em|vh|vw|vmin|vmax|dvh|svh|lvh|dvw|ch|ex|pt|cqw|cqh)$`
);
/** `50%`. Read only where the literal is nothing but CSS values. */
export const PERCENT = new RegExp(`^${NUMBER}%$`);
/** `200ms`, `0.3s`. */
export const DURATION = /^(?:\d+|\d*\.\d+)(ms|s)$/;
/** `#fff`, `#ffffff`, `#ffffff80`. */
export const HEX_COLOR =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/** Three or four hex digits with no letter also reads as an issue number. */
export const AMBIGUOUS_HEX = /^#\d{3,4}$/;
export const COLOR_FUNCTION =
  /(^|[^a-zA-Z0-9_-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\(\s*[-\d.a-z%]/;
export const EASING =
  /(^|[^a-zA-Z0-9_-])(cubic-bezier\(|steps\(\s*\d|ease-in-out\b|ease-in\b|ease-out\b)/;
export const FONT_NAME =
  /(^|[^a-zA-Z0-9_-])(sans-serif|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|system-ui|-apple-system|BlinkMacSystemFont|Helvetica( Neue)?|Arial|Segoe UI|Roboto|Menlo|Monaco|Consolas|Courier New|Times New Roman|Georgia|Verdana|Tahoma|SF Pro( Text| Display)?|SF Mono|JetBrains Mono|Fira (Code|Sans|Mono)|Bricolage Grotesque|Noto Sans|Open Sans|Source Sans|IBM Plex [A-Z][a-z]+)($|[^a-zA-Z0-9_-])/;
/** Generic families, only when the literal is nothing else. */
export const GENERIC_FONT = /^(serif|monospace|cursive|fantasy|Inter)$/;
export const MEDIA_QUERY =
  /@(media|container|supports)\b|\((min|max)-(width|height)\s*:|prefers-(color-scheme|reduced-motion|contrast)/;
export const Z_INDEX_NAMES: ReadonlySet<string> = new Set([
  'zIndex',
  'z-index',
]);

const COLOR_WORD =
  'surface|background|text|tint|destructive|success|warning|info|border|system|on|icon|primary|secondary|muted|accent|white|black|transparent|current|inherit|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone';
const STEP = String.raw`(?:\d+(?:\.\d+)?|px|full|auto|screen|min|max|fit|\[[^\]]+\])`;

/** Utility-class shapes. A literal carrying one is a class string. */
export const UTILITY_CLASS = new RegExp(
  `^-?(?:[a-z-]+:)*(?:` +
    [
      `(?:gap|gap-x|gap-y|space-x|space-y|p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|w|h|size|min-w|min-h|max-w|max-h|inset|inset-x|inset-y|top|right|bottom|left|basis|z|opacity|order|grid-cols|grid-rows|col-span|row-span|line-clamp|leading|tracking|translate-x|translate-y|rotate|scale|duration|delay|border|border-[trblxy]|rounded|rounded-[trbl]|rounded-[trbl][trbl]|ring|outline|blur|columns)-${STEP}`,
      `flex-(?:row|col|row-reverse|col-reverse|wrap|nowrap|wrap-reverse|1|auto|initial|none)`,
      `(?:inline-flex|inline-grid|inline-block|sr-only|not-sr-only)`,
      `items-(?:center|start|end|stretch|baseline)`,
      `justify-(?:center|between|start|end|around|evenly|stretch)`,
      `(?:self|place-items|place-content|place-self|content|justify-items|justify-self)-(?:center|start|end|stretch|baseline|auto|between|around|evenly)`,
      `(?:shrink|grow)(?:-0)?`,
      `overflow(?:-[xy])?-(?:hidden|auto|scroll|visible|clip)`,
      `(?:whitespace|break|select|pointer-events|cursor|object|align|text-wrap|touch)-[a-z-]+`,
      `text-(?:left|right|center|justify|start|end|xs|sm|base|lg|xl|[2-9]xl|2xs|micro|nano|caption|action)`,
      `font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|display|sans|mono|serif)`,
      `(?:bg|text|border|fill|stroke|ring|outline|decoration|divide|from|via|to|accent|caret|shadow)-(?:${COLOR_WORD})(?:-[a-z0-9-]+)?(?:/\\d+)?`,
      `rounded-(?:none|sm|md|lg|xl|[2-9]xl|full|control|card|sheet)`,
      `(?:shadow|drop-shadow)(?:-[a-z0-9]+)?`,
      `(?:absolute|relative|fixed|sticky|truncate|uppercase|lowercase|capitalize|italic|underline|line-through|antialiased)`,
      `(?:animate|transition|ease)-[a-z-]+`,
      `text(?:Body|BodyBold|Caption|Label|Title|Subtitle|Heading|NavigationTitle|Footnote|Mono|Numeral|Link)`,
      `(?:clickable|clickableTint|panel|panelItem|safe-(?:top|bottom|left|right))`,
    ].join('|') +
    `)$`
);

/**
 * Bare words that are utilities only beside another utility (`flex gap-2`,
 * `box text`): alone they are ordinary identifiers.
 */
export const UTILITY_COMPANION =
  /^(flex|grid|block|inline|hidden|contents|box|text|border|rounded|shadow|container|isolate|visible|invisible|static)$/;

/** Margin utilities and declarations: spacing between siblings is a parent's gap. */
export const MARGIN_CLASS =
  /^-?(?:[a-z-]+:)*m[trblxyse]?-(?!0$)[a-z0-9.[\]/-]+$/;
export const MARGIN_DECLARATION =
  /(^|[;{\s])margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*(?!0\s*(?:;|}|!|$))[^;}]+/;

/** Props that carry a visual decision, so they take token names only. */
export const VISUAL_PROP =
  /^(?:size|gap|rowGap|columnGap|padding|paddingX|paddingY|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|inset|width|height|minWidth|minHeight|maxWidth|maxHeight|radius|color|tone|background|backgroundColor|borderColor|textColor|fill|stroke|strokeWidth|opacity|elevation|shadow|zIndex|duration|delay|easing|fontSize|fontWeight|fontFamily|lineHeight|letterSpacing|spacing|thickness|offset)$|(?:Size|Gap|Padding|Margin|Inset|Width|Height|Radius|Color|Tone|Opacity|Elevation|Shadow|Duration|Easing|Spacing|Thickness|Offset)$/;

/** Prop names that hand styling to the caller. */
export const OPEN_STYLE_PROP =
  /^(?:class|className|classList|style|sx|css|tw)$|(?:Class|ClassName|ClassList|Style|Sx)$/;

/** Semantics welded to layout: compose the two instead. */
export const COMBINED_COMPONENT =
  /^(?:Nav|Header|Footer|Main|Aside|Section|Article|H[1-6]|P|Ul|Ol|Li|Heading|Paragraph)(?:Stack|StackVertical|StackHorizontal|Grid|Row|Column|ScrollArea|Scroll|Box|Flex|Cluster|Inline)/;
