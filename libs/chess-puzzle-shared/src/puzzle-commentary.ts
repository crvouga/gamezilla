import {
  applyUci,
  legalMoves,
  positionStatus,
} from '@pkgs/chess-rules-shared/moves';
import { hangingPieces, knightForks } from '@pkgs/chess-rules-shared/tactics';
import type { ObservationKind } from './observation-policy';
import { chooseObservation } from './observation-policy';

export type CommentaryInput = {
  readonly puzzleId: string;
  readonly fen: string | null;
  readonly status: string;
  readonly solveIdx: number;
  readonly layoutKey: number;
  readonly wrongUci: string | null;
  readonly hint: 'none' | 'highlight' | 'solution';
  readonly opponentReplying: boolean;
  readonly viewingHistory: boolean;
};
export type PuzzleCommentary = {
  readonly kind: ObservationKind | 'checkmate' | 'progress' | 'hint' | 'review';
  readonly purpose: string;
  readonly puzzleId: string;
  readonly positionKey: string;
  readonly text: string;
};
const PIECES = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
} as const;

function diagnosis(input: CommentaryInput): {
  kind: ObservationKind;
  text: string;
} {
  const fen = input.fen!;
  const board = positionStatus(fen);
  const attempted =
    input.wrongUci === null ? null : applyUci(fen, input.wrongUci);
  const after = attempted?.ok === true ? attempted.fen : null;
  const hanging = after === null ? [] : hangingPieces(after);
  const forks = after === null ? [] : knightForks(after);
  const mate = legalMoves(fen).some((move) => {
    const played = applyUci(fen, move.uci);
    return played.ok && played.isCheckmate;
  });
  const kind = chooseObservation({
    status: 'wrong',
    check: board?.isCheck ?? false,
    mate,
    hanging: hanging.length > 0,
    fork: forks.length > 0,
  });
  if (kind === 'check')
    return {
      kind,
      text: 'Your king is in check. Find a legal way to escape it.',
    };
  if (kind === 'missed mate')
    return {
      kind,
      text: 'There is a checkmate available. Look for a move that leaves the king no escape.',
    };
  const piece = hanging[0];
  if (kind === 'hanging piece' && piece !== undefined)
    return {
      kind,
      text: `That move would leave your ${PIECES[piece.piece]} on ${piece.square} hanging: it can be captured without a recapture.`,
    };
  const fork = forks[0];
  if (kind === 'knight fork' && fork !== undefined)
    return {
      kind,
      text: `That move allows a knight fork on ${fork.square}, attacking your ${fork.targets.map((target) => `${PIECES[target.piece]} on ${target.square}`).join(' and ')}.`,
    };
  return {
    kind: 'wrong',
    text: 'That move does not solve the puzzle. Try another continuation, or ask for a hint.',
  };
}

function observation(
  input: CommentaryInput
): Pick<PuzzleCommentary, 'kind' | 'text'> {
  if (input.viewingHistory)
    return {
      kind: 'review',
      text: 'You are reviewing an earlier position. Return to the current move to continue.',
    };
  if (input.status === 'solving' && input.opponentReplying)
    return {
      kind: input.solveIdx > 1 ? 'progress' : 'ready',
      text:
        input.solveIdx > 1
          ? 'Correct continuation. Watch the opponent’s reply.'
          : 'Watch the opponent’s move, then find your continuation.',
    };
  if (input.status === 'wrong') return diagnosis(input);
  if (input.status === 'solved')
    return positionStatus(input.fen!)?.isCheckmate
      ? { kind: 'checkmate', text: 'Checkmate! You found a valid finish.' }
      : { kind: 'solved', text: 'Puzzle solved. Well played.' };
  if (input.status === 'revealed')
    return {
      kind: 'revealed',
      text: 'The solution is shown. You can step through the moves to learn the line.',
    };
  if (input.status === 'skipped')
    return {
      kind: 'skipped',
      text: 'Puzzle skipped. Move on when you are ready.',
    };
  return ongoingObservation(input);
}

function ongoingObservation(
  input: CommentaryInput
): Pick<PuzzleCommentary, 'kind' | 'text'> {
  if (input.hint !== 'none')
    return {
      kind: 'hint',
      text:
        input.hint === 'highlight'
          ? 'The highlighted piece starts the solution move.'
          : 'The arrow shows the solution move.',
    };
  if (positionStatus(input.fen!)?.isCheck)
    return {
      kind: 'check',
      text: 'Your king is in check. Find a legal way to escape it.',
    };
  if (input.solveIdx > 1)
    return {
      kind: 'progress',
      text: 'Correct continuation. The opponent has replied; find your next move.',
    };
  return {
    kind: 'ready',
    text: 'Find the solution or a legal checkmate. Take your time.',
  };
}

export function puzzleCommentary(
  input: CommentaryInput
): PuzzleCommentary | null {
  if (input.status === 'loading' || input.status === 'idle') return null;
  const result =
    input.fen === null ||
    positionStatus(input.fen) === null ||
    input.status === 'invalid'
      ? {
          kind: 'unavailable' as const,
          text: 'This puzzle cannot be played. Move on to another puzzle.',
        }
      : observation(input);
  const purpose = input.status === 'solving' ? 'ready' : input.status;
  return {
    ...result,
    purpose,
    puzzleId: input.puzzleId,
    positionKey: [
      input.puzzleId,
      input.fen,
      input.status,
      input.solveIdx,
      input.layoutKey,
      input.wrongUci,
      input.hint,
      input.opponentReplying,
      input.viewingHistory,
    ].join('|'),
  };
}
