/**
 * What someone listening to the app hears about the chess puzzle on the
 * board, as plain parts the client words and puts in its live region: the
 * opponent's setup move or reply and whose move it is, the solver's own
 * move and the piece a hint picks. A wrong move, the result and the rating
 * change are every game's (`@libs/game-puzzle-shared/puzzle-result-announcement`).
 */

import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import type { PieceType } from '@pkgs/chess-board-core-shared/types';
import { Chess } from 'chess.js';

export type PuzzleSide = 'white' | 'black';

const SPOKEN_PIECE: Record<PieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/** The piece a hint names, in the words the live region says. */
export function spokenPiece(type: PieceType): string {
  return SPOKEN_PIECE[type];
}

export type PuzzleAnnouncementPart =
  | {
      readonly kind: 'opponentMove';
      /** The first move of the line, played before the solver's turn. */
      readonly setup: boolean;
      readonly side: PuzzleSide;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly kind: 'solverMove';
      readonly side: PuzzleSide;
      readonly from: string;
      readonly to: string;
    }
  | { readonly kind: 'toMove'; readonly side: PuzzleSide }
  | {
      readonly kind: 'hint';
      readonly side: PuzzleSide;
      readonly piece: PieceType;
      readonly square: string;
    };

export type PuzzleAnnouncementInput = {
  readonly status: SolveStatus;
  /** The puzzle line as UCI moves; the first is the opponent's setup move. */
  readonly moves: string;
  /** How many moves of the line the board shows. */
  readonly solveIdx: number;
  /** The side the solver plays. */
  readonly solverSide: PuzzleSide;
  readonly hintStage: HintStage;
  /** The position on the board (FEN) the hint is read from. */
  readonly fen: string | null;
  /** The square of the piece the hint picks, when one is picked. */
  readonly hintSquare: string | null;
};

function otherSide(side: PuzzleSide): PuzzleSide {
  return side === 'white' ? 'black' : 'white';
}

function lastMovePart(
  input: PuzzleAnnouncementInput
): PuzzleAnnouncementPart | null {
  const tokens = input.moves.trim().split(/\s+/).filter(Boolean);
  const index = input.solveIdx - 1;
  const uci = tokens[index];
  if (index < 0 || uci === undefined || uci.length < 4) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  // The opponent plays the even moves of the line (the setup move first),
  // the solver the odd ones.
  if (index % 2 === 0) {
    const side = otherSide(input.solverSide);
    return { kind: 'opponentMove', setup: index === 0, side, from, to };
  }
  return { kind: 'solverMove', side: input.solverSide, from, to };
}

function hintPart(
  input: PuzzleAnnouncementInput
): PuzzleAnnouncementPart | null {
  if (input.hintStage === 'none' || input.hintSquare === null) return null;
  if (input.fen === null || input.fen.length === 0) return null;
  let piece: ReturnType<Chess['get']>;
  try {
    piece = new Chess(input.fen).get(input.hintSquare as never);
  } catch {
    return null;
  }
  if (!piece) return null;
  return {
    kind: 'hint',
    side: piece.color === 'w' ? 'white' : 'black',
    piece: piece.type,
    square: input.hintSquare,
  };
}

/** The parts heard of the puzzle's moves while it is solved; none otherwise. */
export function puzzleAnnouncement(
  input: PuzzleAnnouncementInput
): readonly PuzzleAnnouncementPart[] {
  if (input.status !== 'solving') return [];
  const parts: PuzzleAnnouncementPart[] = [];
  const last = lastMovePart(input);
  if (last !== null) parts.push(last);
  if (last === null || last.kind === 'opponentMove') {
    parts.push({ kind: 'toMove', side: input.solverSide });
  }
  const hint = hintPart(input);
  if (hint !== null) parts.push(hint);
  return parts;
}
