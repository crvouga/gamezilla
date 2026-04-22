/**
 * Subsequence fuzzy match with bonuses for contiguous runs and word-start matches.
 * Returns null when query is non-empty and does not match as a subsequence.
 */

export type FuzzyMatchResult = {
  score: number;
  /** Inclusive character index ranges in `text` that matched. */
  ranges: [number, number][];
};

function isWordStartIndex(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1];
  if (prev === undefined) return true;
  return /[\s/_-]/.test(prev);
}

/**
 * Merge adjacent [start,end] ranges (inclusive).
 */
function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      out.push(cur);
    }
  }
  return out;
}

export function fuzzyMatch(query: string, text: string): FuzzyMatchResult | null {
  const q = query.trim().toLowerCase();
  const hay = text.toLowerCase();
  if (q === '') {
    return { score: 0, ranges: [] };
  }

  let qi = 0;
  const matchIndices: number[] = [];
  for (let i = 0; i < hay.length && qi < q.length; i++) {
    if (hay[i] === q[qi]) {
      matchIndices.push(i);
      qi++;
    }
  }
  if (qi < q.length) {
    return null;
  }

  let score = 0;
  const rawRanges: [number, number][] = [];

  for (let m = 0; m < matchIndices.length; m++) {
    const idx = matchIndices[m]!;
    score += 1;
    if (m > 0 && matchIndices[m - 1]! + 1 === idx) {
      score += 3;
    }
    if (isWordStartIndex(hay, idx)) {
      score += 2;
    }
    rawRanges.push([idx, idx]);
  }

  return { score, ranges: mergeRanges(rawRanges) };
}
