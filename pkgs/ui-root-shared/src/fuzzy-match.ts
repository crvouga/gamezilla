/**
 * Subsequence fuzzy match with bonuses for contiguous runs and word-start
 * matches. Returns `null` when the query is non-empty and does not match as
 * a subsequence.
 */

export type MatchRange = [number, number];

export type FuzzyMatchResult = {
  score: number;
  /** Inclusive character index ranges in `text` that matched. */
  ranges: MatchRange[];
};

const CONTIGUOUS_BONUS = 3;
const WORD_START_BONUS = 2;

function isWordStartIndex(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1];
  if (prev === undefined) return true;
  return /[\s/_-]/.test(prev);
}

/** Merge overlapping / adjacent inclusive `[start, end]` ranges. */
export function mergeRanges(ranges: readonly MatchRange[]): MatchRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: MatchRange[] = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      out.push([start, end]);
    }
  }
  return out;
}

function subsequenceIndices(query: string, hay: string): number[] | null {
  let qi = 0;
  const indices: number[] = [];
  for (let i = 0; i < hay.length && qi < query.length; i++) {
    if (hay[i] === query[qi]) {
      indices.push(i);
      qi++;
    }
  }
  return qi < query.length ? null : indices;
}

export function fuzzyMatch(
  query: string,
  text: string
): FuzzyMatchResult | null {
  const q = query.trim().toLowerCase();
  const hay = text.toLowerCase();
  if (q === '') {
    return { score: 0, ranges: [] };
  }
  const indices = subsequenceIndices(q, hay);
  if (indices === null) return null;

  let score = 0;
  let previous = -2;
  const rawRanges: MatchRange[] = [];
  for (const idx of indices) {
    score += 1;
    if (previous + 1 === idx) score += CONTIGUOUS_BONUS;
    if (isWordStartIndex(hay, idx)) score += WORD_START_BONUS;
    rawRanges.push([idx, idx]);
    previous = idx;
  }
  return { score, ranges: mergeRanges(rawRanges) };
}
