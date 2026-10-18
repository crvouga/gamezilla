/**
 * Spectator move suggestions: room-synced annotations keyed by the suggesting
 * member, each naming two cells of the game's board. Pure — the reducer and
 * the renderer both fold the same map. Which text is a cell is the game's
 * (`PuzzlesCapability.isCell`), checked where a suggestion is made.
 */

/** At most one arrow per member, and at most this many members on the board. */
export const PUZZLE_MAX_RECOMMENDATIONS = 8;

export type PuzzleRecommendation = {
  readonly from: string;
  readonly to: string;
  /** Monotonic insertion order; the eviction order when the cap is hit. */
  readonly seq: number;
};

export type PuzzleRecommendationMap = Readonly<
  Record<string, PuzzleRecommendation>
>;

export type PuzzleRecommendationEntry = PuzzleRecommendation & {
  readonly by: string;
};

/** The longest cell name a suggestion carries. */
const MAX_CELL_LENGTH = 16;

/** A cell's shape on the wire: short text without whitespace. */
export function isCellText(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    v.length <= MAX_CELL_LENGTH &&
    !/\s/.test(v)
  );
}

function readRecommendation(v: unknown): PuzzleRecommendation | null {
  if (v === null || typeof v !== 'object') return null;
  const record = v as Record<string, unknown>;
  const from = record['from'];
  const to = record['to'];
  const seq = record['seq'];
  if (!isCellText(from) || !isCellText(to)) return null;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0) return null;
  return { from, to, seq };
}

/** Lenient parser for the room attr: anything malformed is dropped. */
export function parseRecommendations(v: unknown): PuzzleRecommendationMap {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, PuzzleRecommendation> = {};
  for (const [by, raw] of Object.entries(v as Record<string, unknown>)) {
    if (by.length === 0) continue;
    const parsed = readRecommendation(raw);
    if (parsed !== null) out[by] = parsed;
  }
  return out;
}

function nextSeq(current: PuzzleRecommendationMap): number {
  let max = 0;
  for (const entry of Object.values(current)) {
    if (entry.seq > max) max = entry.seq;
  }
  return max + 1;
}

function evictOldest(current: Record<string, PuzzleRecommendation>): void {
  if (Object.keys(current).length <= PUZZLE_MAX_RECOMMENDATIONS) return;
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
  readonly current: PuzzleRecommendationMap;
  readonly by: string;
  readonly from: string;
  readonly to: string;
}): PuzzleRecommendationMap {
  const next: Record<string, PuzzleRecommendation> = { ...args.current };
  next[args.by] = { from: args.from, to: args.to, seq: nextSeq(args.current) };
  evictOldest(next);
  return next;
}

/** Drop one member's suggestion (their own clear, or their seat leaving). */
export function clearRecommendation(
  current: PuzzleRecommendationMap,
  by: string
): PuzzleRecommendationMap {
  if (current[by] === undefined) return current;
  const next: Record<string, PuzzleRecommendation> = { ...current };
  delete next[by];
  return next;
}

/** Stable (oldest-first) list so every client renders the same order. */
export function sortedRecommendations(
  m: PuzzleRecommendationMap
): readonly PuzzleRecommendationEntry[] {
  return Object.entries(m)
    .map(([by, entry]) => ({
      by,
      from: entry.from,
      to: entry.to,
      seq: entry.seq,
    }))
    .sort((a, b) => (a.seq === b.seq ? (a.by < b.by ? -1 : 1) : a.seq - b.seq));
}
