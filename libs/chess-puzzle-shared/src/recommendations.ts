/**
 * Spectator move suggestions: room-synced annotations keyed by the suggesting
 * member. Pure — the reducer and the renderer both fold the same map.
 */

import type { BoardArrow, Square } from '@pkgs/chess-board-core-shared/types';

/** At most one arrow per member, and at most this many members on the board. */
export const CHESS_PUZZLE_MAX_RECOMMENDATIONS = 8;

export type ChessPuzzleRecommendation = {
  readonly from: Square;
  readonly to: Square;
  /** Monotonic insertion order; the eviction order when the cap is hit. */
  readonly seq: number;
};

export type ChessPuzzleRecommendationMap = Readonly<
  Record<string, ChessPuzzleRecommendation>
>;

export type ChessPuzzleRecommendationEntry = ChessPuzzleRecommendation & {
  readonly by: string;
};

const SQUARE_PATTERN = /^[a-h][1-8]$/;

/** Board coordinate guard (wire payloads carry unvalidated strings). */
export function isBoardSquare(v: unknown): v is Square {
  return typeof v === 'string' && SQUARE_PATTERN.test(v);
}

function readRecommendation(v: unknown): ChessPuzzleRecommendation | null {
  if (v === null || typeof v !== 'object') return null;
  const record = v as Record<string, unknown>;
  const from = record['from'];
  const to = record['to'];
  const seq = record['seq'];
  if (!isBoardSquare(from) || !isBoardSquare(to)) return null;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return null;
  return { from, to, seq };
}

/** Lenient parser for the room attr: anything malformed is dropped. */
export function parseRecommendations(v: unknown): ChessPuzzleRecommendationMap {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, ChessPuzzleRecommendation> = {};
  for (const [by, raw] of Object.entries(v as Record<string, unknown>)) {
    if (by.length === 0) continue;
    const parsed = readRecommendation(raw);
    if (parsed !== null) out[by] = parsed;
  }
  return out;
}

function nextSeq(current: ChessPuzzleRecommendationMap): number {
  let max = 0;
  for (const entry of Object.values(current)) {
    if (entry.seq > max) max = entry.seq;
  }
  return max + 1;
}

function evictOldest(current: Record<string, ChessPuzzleRecommendation>): void {
  if (Object.keys(current).length <= CHESS_PUZZLE_MAX_RECOMMENDATIONS) return;
  let oldestKey: string | null = null;
  let oldestSeq = Number.POSITIVE_INFINITY;
  for (const [by, entry] of Object.entries(current)) {
    if (entry.seq < oldestSeq) {
      oldestSeq = entry.seq;
      oldestKey = by;
    }
  }
  if (oldestKey !== null) delete current[oldestKey];
}

/** Record (or replace) one member's suggestion, evicting the oldest at the cap. */
export function recommendMove(args: {
  readonly current: ChessPuzzleRecommendationMap;
  readonly by: string;
  readonly from: Square;
  readonly to: Square;
}): ChessPuzzleRecommendationMap {
  const next: Record<string, ChessPuzzleRecommendation> = { ...args.current };
  next[args.by] = { from: args.from, to: args.to, seq: nextSeq(args.current) };
  evictOldest(next);
  return next;
}

/** Drop one member's suggestion (their own clear, or their seat leaving). */
export function clearRecommendation(
  current: ChessPuzzleRecommendationMap,
  by: string
): ChessPuzzleRecommendationMap {
  if (current[by] === undefined) return current;
  const next: Record<string, ChessPuzzleRecommendation> = { ...current };
  delete next[by];
  return next;
}

/** Stable (oldest-first) list so every client renders the same order. */
export function sortedRecommendations(
  m: ChessPuzzleRecommendationMap
): readonly ChessPuzzleRecommendationEntry[] {
  return Object.entries(m)
    .map(([by, entry]) => ({
      by,
      from: entry.from,
      to: entry.to,
      seq: entry.seq,
    }))
    .sort((a, b) => (a.seq === b.seq ? (a.by < b.by ? -1 : 1) : a.seq - b.seq));
}

const EMPTY_ARROWS: readonly BoardArrow[] = Object.freeze([]);

/**
 * Board arrows for every suggestion except `excludeMemberId` (the viewer who
 * drew theirs locally — the board already renders their own drag).
 */
export function recommendationArrows(args: {
  readonly recommendations: ChessPuzzleRecommendationMap;
  readonly colorFor: (memberId: string) => string;
  readonly excludeMemberId?: string | null;
}): readonly BoardArrow[] {
  const entries = sortedRecommendations(args.recommendations).filter(
    (entry) => entry.by !== args.excludeMemberId
  );
  if (entries.length === 0) return EMPTY_ARROWS;
  return entries.map((entry) => ({
    from: entry.from,
    to: entry.to,
    color: args.colorFor(entry.by),
    id: `rec:${entry.by}`,
  }));
}

/** Human label for a suggestion chip, e.g. `e2→e4`. */
export function formatRecommendedMove(from: Square, to: Square): string {
  return `${from}→${to}`;
}
