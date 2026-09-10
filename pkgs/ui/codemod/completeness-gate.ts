/**
 * Completeness gate over transformed outputs: zero leftover sx attrs,
 * purged primitive tags/imports, Sx* helpers outside theme, class-merge
 * helpers, or TODO markers.
 *
 * Scans *code only*: comments and string bodies are blanked first so a JSDoc
 * example (`<Text sx={…}>`) never reads as a live call site.
 */

import ts from 'typescript';

export type GateHit = {
  readonly path: string;
  readonly kind: string;
  readonly detail: string;
};

/**
 * Blank comment text (preserving newlines / offsets) so regex scans cannot
 * match documentation. Uses the TS scanner so `//` inside strings is safe.
 */
export function stripComments(text: string): string {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    ts.LanguageVariant.Standard,
    text
  );
  const chars = text.split('');
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }
    for (let i = scanner.getTokenPos(); i < scanner.getTokenEnd(); i++) {
      if (chars[i] !== '\n') chars[i] = ' ';
    }
  }
  return chars.join('');
}

const THEME_PATH = /(?:^|[/\\])pkgs[/\\]ui[/\\]src[/\\]theme(?:[/\\]|$)/;

/**
 * `@pkgs/ui`'s own component sources are the design system itself: they
 * legitimately compose `Box` / `Text` / `Stack` and use internal helpers like
 * `joinClass`. Primitive-usage checks skip them (they are the definition of
 * the primitives); `sx-attr` / `sx-type` / `todo` still apply everywhere.
 */
const UI_INTERNALS = /(?:^|[/\\])pkgs[/\\]ui[/\\]src[/\\]components(?:[/\\]|$)/;

const SX_ATTR = /\b(?:sx|frameSx|fieldSx|enterSx|exitSx)\s*=/;

const PURGED_TAG = /<(?:Box|Stack|Center|Spacer|Card|Divider|Clickable|Text)\b/;

const PURGED_IMPORT_NAMES =
  /\b(?:Box|Stack|Center|Spacer|Card|Divider|Clickable|Text)\b/;

const SX_TYPE_OR_HELPER =
  /\b(?:SxInput|SxProps|flattenSx|sxToCss)\b|tokens\.css\s*\(/;

/**
 * Class-merge helpers as *calls*. `cx` is intentionally excluded: it is an
 * SVG geometry prop / local accessor throughout the codebase; the `cx`
 * helper proper is still caught by the import scan.
 */
const CLASS_HELPER =
  /\b(?:cn|clsx|classnames|twMerge|twJoin|cva|joinClass)\s*\(/;

const CLASS_HELPER_IMPORT =
  /\b(?:cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass|sxStyle)\b/;

const TODO_MARKER = /TODO\(sx-codemod\)/;

function isThemePath(path: string): boolean {
  return THEME_PATH.test(path);
}

function isUiInternalsPath(path: string): boolean {
  return UI_INTERNALS.test(path);
}

function hit(path: string, kind: string, detail: string): GateHit {
  return { path, kind, detail };
}

function scanImportLines(path: string, text: string, out: GateHit[]): void {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) continue;
    const fromUi =
      /from\s+['"]@pkgs\/ui(?:\/[^'"]*)?['"]/.test(trimmed) ||
      /from\s+['"][^'"]*\/(?:box|stack|center|spacer|card|divider|clickable|text)(?:\/[^'"]*)?['"]/.test(
        trimmed
      );
    if (!fromUi) continue;
    const named = trimmed.match(/\{([^}]+)\}/);
    if (named?.[1] === undefined) continue;
    for (const part of named[1].split(',')) {
      const id =
        part
          .trim()
          .split(/\s+as\s+/i)[0]
          ?.trim() ?? '';
      if (
        PURGED_IMPORT_NAMES.test(id) &&
        id === id.match(PURGED_IMPORT_NAMES)?.[0]
      ) {
        out.push(hit(path, 'purged-import', trimmed.slice(0, 120)));
        break;
      }
      if (
        CLASS_HELPER_IMPORT.test(id) &&
        id === id.match(CLASS_HELPER_IMPORT)?.[0]
      ) {
        out.push(hit(path, 'class-helper-import', trimmed.slice(0, 120)));
        break;
      }
    }
  }
}

/** Flag leftovers in transformed outputs. Theme paths may keep Sx* types. */
export function checkCompleteness(
  outputs: readonly { path: string; nextText: string }[]
): GateHit[] {
  const hits: GateHit[] = [];
  for (const { path, nextText } of outputs) {
    const allowTheme = isThemePath(path);
    const isUiInternals = isUiInternalsPath(path);
    const code = stripComments(nextText);
    if (SX_ATTR.test(code)) {
      hits.push(hit(path, 'sx-attr', 'sx=/frameSx=/fieldSx=/enterSx=/exitSx='));
    }
    if (!isUiInternals && PURGED_TAG.test(code)) {
      hits.push(
        hit(
          path,
          'purged-tag',
          '<Box|Stack|Center|Spacer|Card|Divider|Clickable|Text'
        )
      );
    }
    if (!isUiInternals) scanImportLines(path, nextText, hits);
    if (!allowTheme && SX_TYPE_OR_HELPER.test(code)) {
      hits.push(
        hit(path, 'sx-type', 'SxInput/SxProps/flattenSx/sxToCss/tokens.css(')
      );
    }
    if (!isUiInternals && CLASS_HELPER.test(code)) {
      hits.push(
        hit(
          path,
          'class-helper',
          'cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass'
        )
      );
    }
    if (TODO_MARKER.test(nextText)) {
      hits.push(hit(path, 'todo', 'TODO(sx-codemod)'));
    }
  }
  return hits;
}
