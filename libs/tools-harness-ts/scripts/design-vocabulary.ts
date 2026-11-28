/**
 * Every UI package speaks the design system's vocabulary, run by
 * lint-package.ts over each package its profile names.
 *
 * `@pkgs/ui-root-client-ts` owns how things look: type roles, surfaces, radii,
 * material finishes, depth and every color token. The theme (`theme.css`) only
 * generates token utilities, and this lint rejects what the theme cannot:
 *
 * - every UI package (`design-system`, `component`, `product`): arbitrary
 *   values (`w-[37px]`), raw colors (`#fff`, `rgba(…)`, in TS, TSX and CSS),
 *   steps off the 4px grid (`gap-1.5`), the `dark:` variant, and component-local lighting;
 * - `component` and `product` packages: ad-hoc type (`text-xs`,
 *   `font-bold`) and shadows, which only design-system components paint;
 * - `product` packages: raw elements and restyling attributes
 *   (`design-composition.ts`) — a screen is a composition of components.
 *
 * Pure over the given texts, so it runs inside the cached `lint`.
 */

import { compositionViolations } from './design-composition';

export type DesignSource = { readonly path: string; readonly text: string };

/**
 * - `design-system`: `@pkgs/ui-root-client-ts`, which paints;
 * - `component`: a package of reusable UI (`pkgs/*-client`), which composes
 *   design-system parts and may draw its own primitives (a board);
 * - `product`: screens and app shells, which only compose.
 */
export type DesignProfile = 'design-system' | 'component' | 'product';

type Rule = {
  readonly name: string;
  readonly test: (token: string) => boolean;
  readonly instead: string;
};

const TYPE_UTILITY =
  /^(text-(xs|sm|base|lg|xl|[2-9]xl|2xs|micro|nano|caption|action)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|display|sans|mono)|leading-.+|tracking-.+|uppercase|italic)$/;

/** Spacing and sizing utilities, whose steps are multiples of 4px. */
const OFF_GRID =
  /^-?(p[xytrblse]?|m[xytrblse]?|gap(-[xy])?|space-[xy]|w|h|size|min-[wh]|max-[wh]|inset(-[xy])?|top|right|bottom|left|start|end|translate-[xy]|basis|scroll-[mp][xytrblse]?)-\d*\.\d+$/;

const RAW_COLOR = /^(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch|oklab|color-mix)\()/;

/** `md:hover:gap-2` → `gap-2`; the variant is checked on its own. */
function utility(token: string): string {
  return token.split(':').at(-1) ?? token;
}

const TOKEN_RULES: readonly Rule[] = [
  {
    name: 'arbitrary value',
    test: (token) => /-\[[^\]]+\]$/.test(utility(token)),
    instead: 'a token step or a design-system component',
  },
  {
    name: 'raw color',
    test: (token) => RAW_COLOR.test(token),
    instead: 'a color token (`text-tint`, `var(--ui-color-*)`)',
  },
  {
    name: 'local surface gradient',
    test: (token) => GRADIENT.test(token),
    instead: 'a material finish (`var(--ui-finish-*)`)',
  },
  {
    name: 'off-grid step',
    test: (token) => OFF_GRID.test(utility(token)),
    instead: 'a whole step on the 4px grid (`gap-2`, `p-3`)',
  },
  {
    name: 'dark variant',
    test: (token) => /(^|:)dark:/.test(token),
    instead: 'a shared palette token',
  },
];

const PAINT_RULES: readonly Rule[] = [
  {
    name: 'ad-hoc type',
    test: (token) => TYPE_UTILITY.test(utility(token)),
    instead:
      'a type role (`P` / `Text` `variant`, `H1`–`H6` `size`, or `text textTitle | textHeading | textSubtitle | textBody | textBodyBold | textLabel | textCaption | textFootnote` inside the design system)',
  },
  {
    name: 'shadow',
    test: (token) => /^(drop-)?shadow(-.+)?$/.test(utility(token)),
    instead: 'a shared component with the appropriate material depth',
  },
];

function rulesFor(profile: DesignProfile): readonly Rule[] {
  return profile === 'design-system'
    ? TOKEN_RULES
    : [...TOKEN_RULES, ...PAINT_RULES];
}

/**
 * Files whose colors are not the design's: generated token output and
 * third-party brand marks, which their owners' guidelines fix.
 */
const COLOR_SOURCES = [
  /(^|\/)tokens\.css$/,
  /(^|\/)brand-logos\/index\.tsx$/,
  /(^|\/)social-provider-config\/index\.tsx$/,
];

const STRING_LITERAL = /'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"|`([^`\\]|\\.)*`/g;
const CSS_COLOR =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/g;

/** Comments name the words they ban; only code is read. */
function stripComments(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return '';
  if (trimmed.startsWith('/*')) return '';
  return line;
}

/** Whitespace-separated words of every string literal on `line`. */
function literalTokens(line: string): readonly string[] {
  const out: string[] = [];
  for (const match of stripComments(line).matchAll(STRING_LITERAL)) {
    const body = match[0].slice(1, -1);
    for (const token of body.split(/\s+/)) {
      if (token.length > 0) out.push(token);
    }
  }
  return out;
}

/** Whether `path` is a UI source this lint reads. */
export function isDesignSource(path: string): boolean {
  return /\.(tsx?|css)$/.test(path) && !/(^|\/)tests\//.test(path);
}

/** Whether `path` is product markup the composition rule reads. */
function isProductMarkup(path: string): boolean {
  return /(^|\/)src\/.*\.tsx$/.test(path);
}

function allowsColor(path: string): boolean {
  return COLOR_SOURCES.some((pattern) => pattern.test(path));
}

function scriptViolations(
  file: DesignSource,
  rules: readonly Rule[]
): string[] {
  const out: string[] = [];
  const lines = file.text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const token of literalTokens(lines[i] ?? '')) {
      const rule = rules.find((r) => r.test(token));
      if (rule === undefined) continue;
      if (rule.name === 'raw color' && allowsColor(file.path)) continue;
      out.push(
        `${file.path}:${i + 1}: ${rule.name} "${token}" — use ${rule.instead}`
      );
    }
  }
  return out;
}

/** Alpha masks hide content at a scroll edge. Painted gradients must be shared
 * materials except for these individual board marks and the sticky heading fade. */
const DRAWN_GRADIENTS: Readonly<Record<string, readonly string[]>> = {
  'src/chess-board/chess-board.module.css': [
    '.background',
    '.wash[data-kind="check"]',
    '.hint',
    '.hintCapture',
  ],
  'src/chess-board-squares/move-marks.module.css': [
    '.mark[data-kind="check"]::after',
  ],
  'src/board.css': [
    '[data-board-theme="quoridor"][data-fill] [data-goal="true"]',
    '[data-board-theme="quoridor"][data-fill] [data-cell="e5"][data-goal="true"]',
  ],
  'src/warehouse.module.css': [
    '[data-board-theme="warehouse"] [data-marked="true"]::after',
  ],
  'src/cell-grid-board/cell-grid-board.module.css': [
    '.board[data-board-theme="checkered"] .cell[data-emphasis="pending"], .board[data-board-theme="checkered"] .cell[data-emphasis="preview"]',
    '.board[data-board-theme="sokoban"] .cell[data-identity="four"] .glyph',
  ],
  'src/cell-grid-board/cell-grid-board-battleship.module.css': [
    '.board[data-battleship-surface="target"] .cell[data-tone="open"]',
  ],
  'src/tile-board/tile-board.module.css': ['.mark'],
  'src/disc-drop-board/disc-drop-board.module.css': [
    '.board [data-winning="true"]',
  ],
  'src/game-move-list/game-move-list.module.css': [
    '[data-game-fixed="true"] [data-game-slot="history"] .list[data-layout="table"] .heading::after',
  ],
};

const GRADIENT = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;
const DEPTH = /^var\(--ui-(?:depth-[a-z]+|shadow-float)\)$/;
// A hard-edged ring with no offset or blur can mark focus, selection or a scrim.
const RING =
  /^(?:inset )?0 0 0 (?:\d+(?:px|vmax)|var\(--ui-space-[\w-]+\)) (?:var\(--[\w-]+\)|currentColor)$/;
const ACCENT_STRIPES = new Set([
  'inset 4px 0 0 var(--ui-color-tint-active)',
  'inset 0 var(--ui-space-xs) var(--result-accent)',
  'inset 0 calc(-1 * var(--ui-space-1)) var(--ui-color-game-hearts-accent)',
  'inset var(--ui-space-hairline) 0 currentColor',
  'inset calc(-1 * var(--ui-space-hairline)) 0 currentColor',
]);

function selectorAt(code: string, offset: number): string {
  const open = code.lastIndexOf('{', offset);
  const previous = Math.max(
    code.lastIndexOf('{', open - 1),
    code.lastIndexOf('}', open - 1)
  );
  return code
    .slice(previous + 1, open)
    .trim()
    .replace(/\s+/g, ' ');
}

function materialIssue(
  file: DesignSource,
  code: string,
  match: RegExpExecArray
): string | undefined {
  const offset = match.index;
  const property = match[1]?.toLowerCase() ?? '';
  const value = (match[2] ?? '').trim().replace(/\s+/g, ' ');
  if (/^--ui-(depth|finish)-/.test(property))
    return 'local material definition — define the finish or depth in the shared token generator';
  if (
    GRADIENT.test(value) &&
    !/^(?:-webkit-)?mask(?:-image)?$/.test(property)
  ) {
    const drawing =
      (property === 'background' ||
        property === 'background-image' ||
        property === '--warehouse-stencil') &&
      DRAWN_GRADIENTS[file.path]?.includes(selectorAt(code, offset));
    if (!drawing)
      return 'local surface gradient — use a material finish (`var(--ui-finish-*)`)';
  }
  if (
    property === 'box-shadow' &&
    !/^(?:none|initial|inherit|unset|revert|revert-layer)$/.test(value)
  ) {
    const layers = value.split(',').map((layer) => layer.trim());
    if (
      layers.some(
        (layer) =>
          !(DEPTH.test(layer) || RING.test(layer) || ACCENT_STRIPES.has(layer))
      )
    ) {
      return 'local surface shadow — use a material depth (`var(--ui-depth-*)`)';
    }
  }
  if (/\bdrop-shadow\(/i.test(value)) {
    const windowOutline =
      file.path === 'src/word-tile-board/word-tile-overview.module.css' &&
      selectorAt(code, offset) === '.window' &&
      value === 'drop-shadow(0 0 1px var(--ui-color-board-card-ink))';
    if (!windowOutline)
      return 'local drop shadow — use a material depth (`var(--ui-depth-*)`)';
  }
  return undefined;
}

/** Raw colors in a stylesheet; comments are skipped. */
function stylesheetViolations(
  file: DesignSource,
  profile: DesignProfile
): string[] {
  if (profile === 'design-system' && file.path === 'src/tokens.css') return [];
  const out: string[] = [];
  const code = file.text.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' ')
  );
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const match of (lines[i] ?? '').matchAll(CSS_COLOR)) {
      out.push(
        `${file.path}:${i + 1}: raw color "${match[0]}" — use a color token (\`var(--ui-color-*)\`)`
      );
    }
  }
  if (
    !/gradient\(|box-shadow\s*:|drop-shadow\(|--ui-(depth|finish)-[\w-]+\s*:/i.test(
      code
    )
  )
    return out;
  // Bound a declaration by its block or semicolon, including multiline paints.
  for (const match of code.matchAll(
    /(?:^|[;{])\s*([\w-]+)\s*:\s*([^;{}]+)(?=[;}]|$)/g
  )) {
    const property = match[1] ?? '';
    const issue = materialIssue(file, code, match);
    if (issue !== undefined) {
      const at = match.index + match[0].indexOf(property);
      out.push(
        `${file.path}:${code.slice(0, at).split('\n').length}: ${issue}`
      );
    }
  }
  return out;
}

/** Every off-vocabulary word in `files`, as messages. */
export function designVocabularyViolations(
  files: readonly DesignSource[],
  profile: DesignProfile = 'product'
): readonly string[] {
  const rules = rulesFor(profile);
  const out: string[] = [];
  for (const file of files) {
    if (!isDesignSource(file.path)) continue;
    if (file.path.endsWith('.css')) {
      out.push(...stylesheetViolations(file, profile));
      continue;
    }
    out.push(...scriptViolations(file, rules));
    if (profile === 'product' && isProductMarkup(file.path)) {
      out.push(...compositionViolations(file));
    }
  }
  return out;
}

/** Packages that ship screens or app shells: they only compose. */
const PRODUCT_PACKAGES = [
  /^libs\/[a-z0-9-]+-client-ts$/,
  /^apps\/(admin-client|product-client|product)-ts$/,
  /^pkgs\/(feedback|harness-console)-client-ts$/,
];

/** The profile `pkg` (repo-relative) is linted under, if it is UI at all. */
export function designProfile(pkg: string): DesignProfile | null {
  if (pkg === 'pkgs/ui-root-client-ts') return 'design-system';
  if (PRODUCT_PACKAGES.some((pattern) => pattern.test(pkg))) return 'product';
  if (/^pkgs\/[a-z0-9-]+-client-ts$/.test(pkg)) return 'component';
  return null;
}
