/**
 * Parse typed SAN or UCI move text against a candidate list for keyboard entry.
 */

import type { Move, Square } from '../types';

export type MoveEntryCandidate = {
  readonly from: Square;
  readonly to: Square;
  readonly san?: string;
  readonly promotion?: Move['promotion'];
};

export type MoveEntryResult =
  | { readonly kind: 'exact'; readonly move: MoveEntryCandidate }
  | {
      readonly kind: 'ambiguous';
      readonly matches: readonly MoveEntryCandidate[];
    }
  | { readonly kind: 'none' };

const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i;

/** Normalize user text: trim, lower, strip separators. */
export function normalizeMoveEntry(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '');
}

/**
 * Match `text` against legal candidates. UCI (`e2e4`, `e7e8q`) preferred;
 * SAN compared case-insensitively without `x`/`+`/`#`/`=` noise.
 */
export function resolveMoveEntry(
  text: string,
  candidates: readonly MoveEntryCandidate[]
): MoveEntryResult {
  const raw = normalizeMoveEntry(text);
  if (raw.length === 0) return { kind: 'none' };

  const uci = UCI_RE.exec(raw);
  if (uci !== null) {
    const from = uci[1]!.toLowerCase() as Square;
    const to = uci[2]!.toLowerCase() as Square;
    const promo = uci[3]?.toLowerCase() as Move['promotion'] | undefined;
    const matches = candidates.filter(
      (c) =>
        c.from === from &&
        c.to === to &&
        (promo === undefined || c.promotion === promo)
    );
    if (matches.length === 1) return { kind: 'exact', move: matches[0]! };
    if (matches.length > 1) return { kind: 'ambiguous', matches };
    return { kind: 'none' };
  }

  const sanNeedle = raw.replace(/[x+#=]/g, '');
  const matches = candidates.filter((c) => {
    if (c.san === undefined) return false;
    return normalizeMoveEntry(c.san).replace(/[x+#=]/g, '') === sanNeedle;
  });
  if (matches.length === 1) return { kind: 'exact', move: matches[0]! };
  if (matches.length > 1) return { kind: 'ambiguous', matches };
  return { kind: 'none' };
}
