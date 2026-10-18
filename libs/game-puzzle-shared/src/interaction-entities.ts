import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';

/** Append-only puzzle interaction log (one row per event). */
export const PUZZLE_INTERACTION_ENTITY_TYPE = 'chess.puzzle.interaction';

export const PUZZLE_INTERACTION_KIND = {
  started: 'started',
  moved: 'moved',
  usedHint: 'used-hint',
  solved: 'solved',
  /** First wrong move, or the solution shown before the puzzle was resolved. */
  failed: 'failed',
  abandoned: 'abandoned',
} as const;

export type PuzzleInteractionKind =
  (typeof PUZZLE_INTERACTION_KIND)[keyof typeof PUZZLE_INTERACTION_KIND];

/**
 * The rated outcome of a play (§5): at most one per play — the first of a
 * clean or hinted solve, a fail, or an abandon. Nothing after it re-rates.
 */
export type PuzzleOutcomeKind =
  | typeof PUZZLE_INTERACTION_KIND.solved
  | typeof PUZZLE_INTERACTION_KIND.failed
  | typeof PUZZLE_INTERACTION_KIND.abandoned;

export function isOutcomeKind(
  kind: PuzzleInteractionKind
): kind is PuzzleOutcomeKind {
  return (
    kind === PUZZLE_INTERACTION_KIND.solved ||
    kind === PUZZLE_INTERACTION_KIND.failed ||
    kind === PUZZLE_INTERACTION_KIND.abandoned
  );
}

const ALL_KINDS: ReadonlySet<string> = new Set<string>(
  Object.values(PUZZLE_INTERACTION_KIND)
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

function readInteractionKind(v: unknown): PuzzleInteractionKind {
  if (typeof v === 'string' && ALL_KINDS.has(v)) {
    return v as PuzzleInteractionKind;
  }
  return PUZZLE_INTERACTION_KIND.started;
}

function readNullableBoolean(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  return null;
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const intNs = createAttrNamespace(
  GAME_PLATFORM_NAMESPACE,
  'puzzle',
  'interaction'
);

export const PuzzleInteractionAttr = {
  /** Indexed: rating projection walks an owner's interaction history. */
  ownerId: intNs.text('owner-id', readNonEmptyString).indexed(),
  /** Indexed: per-puzzle interaction lookups filter `where puzzleId = ?`. */
  puzzleId: intNs.text('puzzle-id', readNonEmptyString).indexed(),
  puzzleRating: intNs.integer('puzzle-rating', readNonNegativeInteger),
  kind: intNs.enum(
    'kind',
    [
      PUZZLE_INTERACTION_KIND.started,
      PUZZLE_INTERACTION_KIND.moved,
      PUZZLE_INTERACTION_KIND.usedHint,
      PUZZLE_INTERACTION_KIND.solved,
      PUZZLE_INTERACTION_KIND.failed,
      PUZZLE_INTERACTION_KIND.abandoned,
    ] as const,
    readInteractionKind
  ),
  solveIdx: intNs.integer('solve-idx', readNonNegativeInteger),
  uci: intNs.textOrNull('uci', readNullableNonEmptyString),
  correct: intNs.booleanOrNull('correct', readNullableBoolean),
  /** Indexed + sortable: history is fetched `ORDER BY at DESC LIMIT N`. */
  at: intNs.timestamp('at', readString).indexed({ sortable: true }),
} as const;

/** Parsed interaction row used by derivation helpers (attempt facts only). */
export type PuzzleInteractionRow = {
  readonly puzzleId: string;
  readonly kind: PuzzleInteractionKind;
  readonly solveIdx: number;
  readonly uci: string | null;
  readonly correct: boolean | null;
  readonly puzzleRating: number;
  readonly at: string;
};

export function interactionRowFromEntityAttributes(
  attrs: Readonly<Record<string, unknown>>
): PuzzleInteractionRow {
  return {
    puzzleId: PuzzleInteractionAttr.puzzleId.from(attrs),
    kind: PuzzleInteractionAttr.kind.from(attrs),
    solveIdx: PuzzleInteractionAttr.solveIdx.from(attrs),
    uci: PuzzleInteractionAttr.uci.from(attrs),
    correct: PuzzleInteractionAttr.correct.from(attrs),
    puzzleRating: PuzzleInteractionAttr.puzzleRating.from(attrs),
    at: PuzzleInteractionAttr.at.from(attrs),
  };
}
