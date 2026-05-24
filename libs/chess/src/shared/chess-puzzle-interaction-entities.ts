import { createAttrNamespace } from '@pkgs/attribute';

/** Append-only puzzle interaction log (one row per event). */
export const CHESS_PUZZLE_INTERACTION_ENTITY_TYPE = 'chess.puzzle.interaction';

export const CHESS_PUZZLE_INTERACTION_KIND = {
  started: 'started',
  moved: 'moved',
  usedHint: 'used-hint',
  solved: 'solved',
  abandoned: 'abandoned',
} as const;

export type ChessPuzzleInteractionKind =
  (typeof CHESS_PUZZLE_INTERACTION_KIND)[keyof typeof CHESS_PUZZLE_INTERACTION_KIND];

const ALL_KINDS: ReadonlySet<string> = new Set<string>(
  Object.values(CHESS_PUZZLE_INTERACTION_KIND)
);

function readNonEmptyString(v: unknown): string {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  return t.length > 0 ? t : '';
}

function readNullableNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readNonNegativeInteger(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseInt(v, 10);
    if (Number.isInteger(n) && n >= 0) return n;
  }
  return 0;
}

function readInteractionKind(v: unknown): ChessPuzzleInteractionKind {
  if (typeof v === 'string' && ALL_KINDS.has(v)) {
    return v as ChessPuzzleInteractionKind;
  }
  return CHESS_PUZZLE_INTERACTION_KIND.started;
}

function readNullableBoolean(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  return null;
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const intNs = createAttrNamespace('chess', 'puzzle', 'interaction');

export const ChessPuzzleInteractionAttr = {
  /** Indexed: rating recompute walks an owner's interaction history. */
  ownerId: intNs.text('owner-id', readNonEmptyString).indexed(),
  /** Indexed: per-puzzle interaction lookups filter `where puzzleId = ?`. */
  puzzleId: intNs.text('puzzle-id', readNonEmptyString).indexed(),
  puzzleRating: intNs.integer('puzzle-rating', readNonNegativeInteger),
  kind: intNs.enum(
    'kind',
    [
      CHESS_PUZZLE_INTERACTION_KIND.started,
      CHESS_PUZZLE_INTERACTION_KIND.moved,
      CHESS_PUZZLE_INTERACTION_KIND.usedHint,
      CHESS_PUZZLE_INTERACTION_KIND.solved,
      CHESS_PUZZLE_INTERACTION_KIND.abandoned,
    ] as const,
    readInteractionKind
  ),
  solveIdx: intNs.integer('solve-idx', readNonNegativeInteger),
  uci: intNs.textOrNull('uci', readNullableNonEmptyString),
  correct: intNs.booleanOrNull('correct', readNullableBoolean),
  /** Indexed + sortable: history is fetched `ORDER BY at DESC LIMIT N`. */
  at: intNs.timestamp('at', readString).indexed({ sortable: true }),
} as const;

/** Parsed interaction row used by derivation helpers. */
export type ChessPuzzleInteractionRow = {
  readonly puzzleId: string;
  readonly kind: ChessPuzzleInteractionKind;
  readonly solveIdx: number;
  readonly uci: string | null;
  readonly correct: boolean | null;
  readonly at: string;
};

export function interactionRowFromEntityAttributes(
  attrs: Readonly<Record<string, unknown>>
): ChessPuzzleInteractionRow {
  return {
    puzzleId: ChessPuzzleInteractionAttr.puzzleId.from(attrs),
    kind: ChessPuzzleInteractionAttr.kind.from(attrs),
    solveIdx: ChessPuzzleInteractionAttr.solveIdx.from(attrs),
    uci: ChessPuzzleInteractionAttr.uci.from(attrs),
    correct: ChessPuzzleInteractionAttr.correct.from(attrs),
    at: ChessPuzzleInteractionAttr.at.from(attrs),
  };
}
