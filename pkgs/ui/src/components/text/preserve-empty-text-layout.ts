import type { JSX } from 'solid-js';

const ZERO_WIDTH_SPACE = '\u200b';

/**
 * Substitutes a zero-width space when `content` is empty or whitespace-only so
 * `Text` keeps one line of height (avoids layout shift while data
 * syncs). Non-string nodes and meaningful strings pass through unchanged.
 */
export function preserveEmptyTextLayout(content: JSX.Element): JSX.Element {
  if (typeof content === 'string' && content.trim() === '') {
    return ZERO_WIDTH_SPACE;
  }
  return content;
}
