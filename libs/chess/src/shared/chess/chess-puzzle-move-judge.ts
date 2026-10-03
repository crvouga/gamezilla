/**
 * Pure verdict on one solver move against the stored puzzle line (spec §5,
 * §34 "Chess logic"). Everything goes through the rules kernel, so castling
 * entered as king-onto-rook and the promotion piece are compared in their
 * canonical UCI form.
 *
 * - `line`: the canonical move equals the expected one.
 * - `mate`: the move checkmates, on the final ply or earlier (an alternative
 *   or faster mate ends the puzzle as solved).
 * - `transposition`: the move is the solver's next line move played one turn
 *   early; the opponent's reply is still legal and the pair reaches the same
 *   position (FEN fields 1–4) as the stored order, so the room continues on
 *   the reordered line.
 * - `wrong`: legal but none of the above.
 * - `illegal`: not a legal move here (the board snaps back, no penalty).
 */
import { isSamePosition } from '@pkgs/chess-rules/fen';
import { applyUci } from '@pkgs/chess-rules/moves';

export type PuzzleMoveAccepted = {
  readonly kind: 'correct';
  readonly via: 'line' | 'mate' | 'transposition';
  /** Canonical UCI of the played move. */
  readonly uci: string;
  readonly san: string;
  /** Position after the solver's move (before any opponent reply). */
  readonly fen: string;
  /** Line the room follows from here (differs from the stored one on mate / transposition). */
  readonly line: readonly string[];
  /** True when this move ends the puzzle. */
  readonly ends: boolean;
};

export type PuzzleMoveJudgement =
  | PuzzleMoveAccepted
  | { readonly kind: 'wrong'; readonly uci: string; readonly san: string }
  | { readonly kind: 'illegal' };

type Applied = { readonly fen: string; readonly uci: string };

function playLine(fen: string, ucis: readonly string[]): Applied | null {
  let current = fen;
  let last = '';
  for (const uci of ucis) {
    const result = applyUci(current, uci);
    if (!result.ok) return null;
    current = result.fen;
    last = result.uci;
  }
  return { fen: current, uci: last };
}

/** Stored line with the solver moves at `idx` and `idx + 2` swapped, when that transposes. */
function transposedLine(args: {
  fen: string;
  tokens: readonly string[];
  idx: number;
  played: string;
}): readonly string[] | null {
  const { fen, tokens, idx, played } = args;
  const expected = tokens[idx];
  const reply = tokens[idx + 1];
  const later = tokens[idx + 2];
  if (expected === undefined || reply === undefined || later === undefined) {
    return null;
  }
  if (played !== later) return null;
  const stored = playLine(fen, [expected, reply, later]);
  const swapped = playLine(fen, [later, reply, expected]);
  if (stored === null || swapped === null) return null;
  if (!isSamePosition(stored.fen, swapped.fen)) return null;
  const line = [...tokens];
  line[idx] = later;
  line[idx + 2] = expected;
  return line;
}

export function judgePuzzleMove(args: {
  /** Position the solver moved from. */
  readonly fen: string;
  /** Stored line (Lichess convention, tokens lower-cased). */
  readonly tokens: readonly string[];
  /** Index of the expected solver move in `tokens`. */
  readonly idx: number;
  readonly uci: string;
}): PuzzleMoveJudgement {
  const { fen, tokens, idx } = args;
  const played = applyUci(fen, args.uci.trim().toLowerCase());
  if (!played.ok) return { kind: 'illegal' };
  const accept = (
    via: PuzzleMoveAccepted['via'],
    line: readonly string[],
    ends: boolean
  ): PuzzleMoveAccepted => ({
    kind: 'correct',
    via,
    uci: played.uci,
    san: played.san,
    fen: played.fen,
    line,
    ends,
  });
  // Terminal chess truth takes precedence even over contradictory stored data.
  if (played.isCheckmate) {
    return accept('mate', [...tokens.slice(0, idx), played.uci], true);
  }
  const expected = tokens[idx];
  const expectedApplied =
    expected === undefined ? null : applyUci(fen, expected);
  if (expectedApplied?.ok === true && expectedApplied.uci === played.uci) {
    return accept('line', tokens, idx + 1 >= tokens.length);
  }
  const transposed = transposedLine({ fen, tokens, idx, played: played.uci });
  if (transposed !== null) return accept('transposition', transposed, false);
  return { kind: 'wrong', uci: played.uci, san: played.san };
}
