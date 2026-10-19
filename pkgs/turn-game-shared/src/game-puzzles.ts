/**
 * Puzzles: a position from a game and the line that solves it, played
 * against the line's own replies. The platform owns the whole lifecycle —
 * the catalogue, choosing the next puzzle, setting it up, judging each
 * move, hints, the solution, ratings, statistics and watchers — over the
 * game's `GameRules`. A game supplies only what its positions and actions
 * alone can say: whether a stored record is one of its puzzles, which
 * spellings of an action are the same move, which positions are the same,
 * and the board cells an action names.
 *
 * Positions and actions stay opaque strings. A puzzle's line is stored as
 * its actions joined by single spaces, so a puzzle action never contains
 * whitespace.
 */

/** One stored puzzle, as the game's positions and actions spell it. */
export type PuzzleRecord = {
  /** `<namespace><local id>`: the catalogue's key. */
  readonly id: string;
  /** The position before the opponent's setup move. */
  readonly position: string;
  /**
   * `line[0]` is the opponent's setup move; the solver then plays
   * `line[1]`, the opponent answers `line[2]`, and so on.
   */
  readonly line: readonly string[];
  readonly rating: number;
  readonly ratingDeviation: number;
  readonly popularity: number;
  readonly plays: number;
  readonly themes: readonly string[];
};

/** Whether the game accepts a stored record as one of its puzzles. */
export type PuzzleRecordVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string; readonly detail: string };

/** The cells an action names on the game's board: a hint, a wrong move. */
export type PuzzleMarks = {
  /** Where the action starts; `null` for an action placed on one cell. */
  readonly from: string | null;
  readonly to: string;
};

/** What a game supplies to be offered puzzles. */
export type PuzzlesCapability = {
  /**
   * The game's share of the puzzle catalogue, its puzzle profiles and its
   * feed settings (`<id>/`); only the platform's durable game keeps `''`.
   */
  readonly namespace: string;
  readonly content: {
    /** Whether `record` is a well-formed, playable puzzle of this game. */
    readonly validate: (record: PuzzleRecord) => PuzzleRecordVerdict;
    /** The catalogue's duplicate key; the position and line verbatim when absent. */
    readonly positionKey?: (record: PuzzleRecord) => string;
  };
  readonly judge?: {
    /**
     * The one spelling of `action` in `position` that the game's rules
     * accept (chess: castling entered as king-onto-rook); `action` itself
     * when absent. A puzzle move and the line's move are the same move
     * exactly when their canonical spellings are equal.
     */
    readonly canonical?: (position: string, action: string) => string;
    /**
     * Whether two positions are the same for the puzzle (chess: ignoring
     * the move clocks), so a transposed pair of solver moves still
     * follows the line; string equality when absent.
     */
    readonly samePosition?: (a: string, b: string) => boolean;
  };
  /** The cells `action` names in `position`; `null` when it names none. */
  readonly marks: (position: string, action: string) => PuzzleMarks | null;
  /** Whether `cell` is a cell of the board (a watcher's suggestion names two). */
  readonly isCell: (cell: string) => boolean;
};
