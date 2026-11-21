/**
 * Lengths and typefaces are tokens. Read by `design-vocabulary.ts` for every
 * UI profile.
 *
 * `design-system/tokens.json` is the one source of every length and font
 * stack; the generated `tokens.css` and `token-names.ts` carry its values.
 * Anywhere else, a pixel literal (`12px`, `-2px`, `0px`) or a font family
 * name (`Manrope`, `"Segoe UI"`, `monospace`) is a second copy that drifts:
 * write `var(--ui-*)` / `calc(var(--ui-*) * n)` in CSS, or a typed token
 * reader in TypeScript, and `0` for nothing. Numeric geometry computed at
 * runtime is not a literal and is left alone.
 *
 * Comments are prose, so they may name a size or a font: only code is read
 * (TypeScript comments are found by the compiler, never by a pattern).
 *
 * One place keeps its pixels: the condition of a CSS `@media` / `@container`
 * query, and Tailwind's `--breakpoint-*` theme entries in `theme.css`, which
 * Tailwind writes into media queries. CSS cannot read a custom property
 * there, so the value is written out (`theme-artifacts.test.ts` holds the
 * breakpoints to the tokens).
 */

import ts from 'typescript';

export type LiteralSource = { readonly path: string; readonly text: string };

/** Generated token output, which carries the values themselves. */
const TOKEN_OUTPUTS = [/(^|\/)tokens\.css$/, /(^|\/)token-names\.ts$/];

/**
 * `12px`, `-2px`, `.5px`, `0px`; not `h-px`, a `${n}px` template hole, or an
 * arbitrary utility value (`w-[37px]`), which `design-vocabulary.ts` reports.
 */
const PX_LITERAL = /(?<![\w$.#[-])-?(?:\d+(?:\.\d+)?|\.\d+)px\b/g;

/** Family names and generic stacks; longer names first so they win. */
const FONT_NAME =
  /(?<![\w-])(?:Manrope|Inter|Arial|Helvetica Neue|Helvetica|-apple-system|BlinkMacSystemFont|system-ui|ui-sans-serif|ui-serif|ui-monospace|Segoe UI|Roboto|Ubuntu|Cantarell|Noto Sans|Menlo|Consolas|Monaco|Courier New|Courier|SFMono-Regular|SF Mono|Liberation Mono|Georgia|Times New Roman|sans-serif|monospace|serif)(?![\w-])/g;

/** A query condition, up to the `{` that opens its block. */
const CSS_QUERY = /@(?:media|container)\b[^{]*/g;

/** A Tailwind breakpoint theme entry (`--breakpoint-sm: 640px;`). */
const THEME_BREAKPOINT = /^\s*--breakpoint-[\w-]+:[^;]*;/gm;

function spaces(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}

/** `text` with every comment replaced by spaces; newlines are kept. */
function blank(text: string, ranges: readonly ts.CommentRange[]): string {
  const chars = text.split('');
  for (const range of ranges) {
    for (let i = range.pos; i < range.end; i++) {
      if (chars[i] !== '\n') chars[i] = ' ';
    }
  }
  return chars.join('');
}

/** Every comment of a TypeScript source, found through its syntax tree. */
function scriptComments(file: LiteralSource): readonly ts.CommentRange[] {
  const kind = file.path.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    false,
    kind
  );
  const found = new Map<number, ts.CommentRange>();
  const pending: ts.Node[] = [source];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    const leading = ts.getLeadingCommentRanges(file.text, node.pos) ?? [];
    const trailing = ts.getTrailingCommentRanges(file.text, node.end) ?? [];
    for (const range of [...leading, ...trailing]) found.set(range.pos, range);
    pending.push(...node.getChildren(source));
  }
  return [...found.values()];
}

/** The code of `file`: comments blanked, line numbers unchanged. */
function codeOf(file: LiteralSource): string {
  if (file.path.endsWith('.css')) {
    const code = file.text
      .replace(/\/\*[\s\S]*?\*\//g, spaces)
      .replace(CSS_QUERY, spaces);
    return /(^|\/)theme\.css$/.test(file.path)
      ? code.replace(THEME_BREAKPOINT, spaces)
      : code;
  }
  return blank(file.text, scriptComments(file));
}

function lineViolations(path: string, line: string, at: number): string[] {
  const out: string[] = [];
  for (const match of line.matchAll(PX_LITERAL)) {
    out.push(
      `${path}:${at}: pixel literal "${match[0]}" — use a length token (\`var(--ui-space-*)\`, \`var(--ui-border-width-*)\`, \`var(--ui-size-*)\`, or \`0\`)`
    );
  }
  for (const match of line.matchAll(FONT_NAME)) {
    out.push(
      `${path}:${at}: font name "${match[0]}" — use a font token (\`var(--ui-font-sans | display | mono)\` or a type role)`
    );
  }
  return out;
}

/** Pixel literals and font names in the code of `file`, as messages. */
export function literalViolations(file: LiteralSource): readonly string[] {
  if (TOKEN_OUTPUTS.some((pattern) => pattern.test(file.path))) return [];
  // A file with no candidate anywhere, comments included, needs no parse.
  if (file.text.search(PX_LITERAL) < 0 && file.text.search(FONT_NAME) < 0) {
    return [];
  }
  const lines = codeOf(file).split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(...lineViolations(file.path, lines[i] ?? '', i + 1));
  }
  return out;
}
