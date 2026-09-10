/**
 * Completeness gate over transformed outputs: zero leftover sx attrs,
 * purged primitive tags/imports, Sx* helpers outside theme, class-merge
 * helpers, or TODO markers.
 */

export type GateHit = {
  readonly path: string;
  readonly kind: string;
  readonly detail: string;
};

const THEME_PATH = /(?:^|[/\\])pkgs[/\\]ui[/\\]src[/\\]theme(?:[/\\]|$)/;

const SX_ATTR = /\b(?:sx|frameSx|fieldSx|enterSx|exitSx)\s*=/;

const PURGED_TAG = /<(?:Box|Stack|Center|Spacer|Card|Divider|Clickable|Text)\b/;

const PURGED_IMPORT_NAMES =
  /\b(?:Box|Stack|Center|Spacer|Card|Divider|Clickable|Text)\b/;

const SX_TYPE_OR_HELPER =
  /\b(?:SxInput|SxProps|flattenSx|sxToCss)\b|tokens\.css\s*\(/;

const CLASS_HELPER =
  /\b(?:cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass)\s*\(/;

const CLASS_HELPER_IMPORT =
  /\b(?:cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass|sxStyle)\b/;

const TODO_MARKER = /TODO\(sx-codemod\)/;

function isThemePath(path: string): boolean {
  return THEME_PATH.test(path);
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
    if (SX_ATTR.test(nextText)) {
      hits.push(hit(path, 'sx-attr', 'sx=/frameSx=/fieldSx=/enterSx=/exitSx='));
    }
    if (PURGED_TAG.test(nextText)) {
      hits.push(
        hit(
          path,
          'purged-tag',
          '<Box|Stack|Center|Spacer|Card|Divider|Clickable|Text'
        )
      );
    }
    scanImportLines(path, nextText, hits);
    if (!allowTheme && SX_TYPE_OR_HELPER.test(nextText)) {
      hits.push(
        hit(path, 'sx-type', 'SxInput/SxProps/flattenSx/sxToCss/tokens.css(')
      );
    }
    if (CLASS_HELPER.test(nextText)) {
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
