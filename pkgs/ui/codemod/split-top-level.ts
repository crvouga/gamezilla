/**
 * Split text on top-level commas, ignoring separators nested in brackets,
 * parens, braces, or string literals (with `\\` escapes).
 */

const QUOTES = new Set(['"', "'", '`']);
const OPENERS = new Set(['(', '[', '{']);
const CLOSERS = new Set([')', ']', '}']);

/** Index just past the closing quote of the literal starting at `open`. */
function skipQuoted(text: string, open: number): number {
  const quote = text[open]!;
  let i = open + 1;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  return i;
}

/** Top-level comma segments (untrimmed; empty input yields one empty part). */
export function splitTopLevel(text: string): readonly string[] {
  const segments: string[] = [];
  let start = 0;
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (QUOTES.has(ch)) {
      i = skipQuoted(text, i);
      continue;
    }
    if (OPENERS.has(ch)) depth += 1;
    else if (CLOSERS.has(ch)) depth -= 1;
    else if (ch === ',' && depth === 0) {
      segments.push(text.slice(start, i));
      start = i + 1;
    }
    i += 1;
  }
  segments.push(text.slice(start));
  return segments;
}
