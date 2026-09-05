export type CompletionCandidate = {
  readonly label: string;
  readonly kind: 'keyword' | 'table' | 'column';
};

export type CompletionResult = {
  readonly candidates: readonly CompletionCandidate[];
  readonly replaceStart: number;
  readonly replaceEnd: number;
};

export type CompletionCatalog = {
  readonly keywords: readonly string[];
  readonly tables: readonly string[];
  readonly columns: readonly string[];
};

/**
 * Prefix match at caret. Word chars are `[A-Za-z0-9_$]`. Empty prefix yields
 * nothing (avoids dumping the whole catalog on every keystroke).
 */
export function completeAt(
  src: string,
  caret: number,
  catalog: CompletionCatalog
): CompletionResult | null {
  const end = clamp(caret, 0, src.length);
  let start = end;
  while (start > 0 && isWordChar(src[start - 1]!)) start -= 1;
  const prefix = src.slice(start, end);
  if (prefix.length === 0) return null;
  const lower = prefix.toLowerCase();
  const candidates: CompletionCandidate[] = [];
  pushMatches(candidates, catalog.keywords, lower, 'keyword');
  pushMatches(candidates, catalog.tables, lower, 'table');
  pushMatches(candidates, catalog.columns, lower, 'column');
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.label.localeCompare(b.label));
  return {
    candidates: candidates.slice(0, 40),
    replaceStart: start,
    replaceEnd: end,
  };
}

export function applyCompletion(
  src: string,
  result: CompletionResult,
  label: string
): { readonly next: string; readonly caret: number } {
  const next =
    src.slice(0, result.replaceStart) + label + src.slice(result.replaceEnd);
  return { next, caret: result.replaceStart + label.length };
}

function pushMatches(
  out: CompletionCandidate[],
  items: readonly string[],
  prefix: string,
  kind: CompletionCandidate['kind']
): void {
  for (const item of items) {
    if (item.toLowerCase().startsWith(prefix)) {
      out.push({ label: item, kind });
    }
  }
}

function isWordChar(ch: string): boolean {
  return (
    (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    (ch >= '0' && ch <= '9') ||
    ch === '_' ||
    ch === '$'
  );
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
