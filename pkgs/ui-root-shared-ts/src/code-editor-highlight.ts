/** Framework-free highlight segmentation for `CodeEditor`. */

import type { CodeToken, CodeTokenKind } from './code-editor-types';

export const CODE_EDITOR_LINE_HEIGHT = 20;
export const CODE_EDITOR_FONT_SIZE = 13;
/** Spacing-scale padding inside the editor frame (×4 px). */
export const CODE_EDITOR_PAD = 2.5;
export const CODE_EDITOR_DEFAULT_MIN_LINES = 3;

export type HighlightSegment = {
  readonly kind: CodeTokenKind;
  readonly text: string;
};

/** Number of visual lines (`\n`-separated) in `value`; at least 1. */
export function countLines(value: string): number {
  let n = 1;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) === 10) n += 1;
  }
  return n;
}

/** Frame height for `value` given a minimum line count. */
export function editorFrameHeight(
  value: string,
  minLines: number,
  padPx: number
): number {
  const lines = Math.max(minLines, countLines(value));
  return lines * CODE_EDITOR_LINE_HEIGHT + padPx * 2;
}

/**
 * Split `value` into contiguous colored segments. Gaps between tokens (and
 * any tail) are emitted as `plain`; overlapping / out-of-order tokens are
 * clipped so the concatenated text always equals `value`.
 */
export function buildHighlightSegments(
  value: string,
  tokens: readonly CodeToken[]
): HighlightSegment[] {
  const out: HighlightSegment[] = [];
  let cursor = 0;
  for (const tok of tokens) {
    const start = Math.max(tok.start, cursor);
    const end = Math.min(tok.end, value.length);
    if (end <= start) continue;
    if (start > cursor) {
      out.push({ kind: 'plain', text: value.slice(cursor, start) });
    }
    out.push({ kind: tok.kind, text: value.slice(start, end) });
    cursor = end;
  }
  if (cursor < value.length) {
    out.push({ kind: 'plain', text: value.slice(cursor) });
  }
  return out;
}
