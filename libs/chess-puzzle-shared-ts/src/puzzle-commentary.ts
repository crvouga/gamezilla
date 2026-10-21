import {
  applyUci,
  hasMateInOne,
  type PositionStatus,
  positionStatus,
} from '@pkgs/chess-rules-shared-ts/moves';
import {
  hangingPieces,
  knightForks,
} from '@pkgs/chess-rules-shared-ts/tactics';
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

function diagnosis(
  input: CommentaryInput,
  board: PositionStatus
): {
  kind: ObservationKind;
  text: string;
} {
  const fen = input.fen!;
  const facts = {
    status: 'wrong',
    check: board.isCheck,
    mate: false,
    hanging: false,
    fork: false,
  } as const;
  if (chooseObservation(facts) === 'check')
    return {
      kind: 'check',
      text: 'Your king is in check. Find a legal way to escape it.',
    };
  if (
    chooseObservation({ ...facts, mate: hasMateInOne(fen) }) === 'missed mate'
  )
    return {
      kind: 'missed mate',
      text: 'There is a checkmate available. Look for a move that leaves the king no escape.',
    };
  const attempted =
    input.wrongUci === null ? null : applyUci(fen, input.wrongUci);
  const after = attempted?.ok === true ? attempted.fen : null;
  const piece = after === null ? undefined : hangingPieces(after)[0];
  if (
    chooseObservation({ ...facts, hanging: piece !== undefined }) ===
      'hanging piece' &&
    piece !== undefined
  )
    return {
      kind: 'hanging piece',
      text: `That move would leave your ${PIECES[piece.piece]} on ${piece.square} hanging: it can be captured without a recapture.`,
    };
  const fork = after === null ? undefined : knightForks(after)[0];
  if (
    chooseObservation({ ...facts, fork: fork !== undefined }) ===
      'knight fork' &&
    fork !== undefined
  )
    return {
      kind: 'knight fork',
      text: `That move allows a knight fork on ${fork.square}, attacking your ${fork.targets.map((target) => `${PIECES[target.piece]} on ${target.square}`).join(' and ')}.`,
    };
  return {
    kind: 'wrong',
    text: 'That move does not solve the puzzle. Try another continuation, or ask for a hint.',
  };
}

function observation(
  input: CommentaryInput,
  board: PositionStatus
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
  if (input.status === 'wrong') return diagnosis(input, board);
  if (input.status === 'solved')
    return board.isCheckmate
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
  return ongoingObservation(input, board);
}

function ongoingObservation(
  input: CommentaryInput,
  board: PositionStatus
): Pick<PuzzleCommentary, 'kind' | 'text'> {
  if (input.hint !== 'none')
    return {
      kind: 'hint',
      text:
        input.hint === 'highlight'
          ? 'The highlighted piece starts the solution move.'
          : 'The arrow shows the solution move.',
    };
  if (board.isCheck)
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
  const board = input.fen === null ? null : positionStatus(input.fen);
  const result =
    board === null || input.status === 'invalid'
      ? {
          kind: 'unavailable' as const,
          text: 'This puzzle cannot be played. Move on to another puzzle.',
        }
      : observation(input, board);
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
