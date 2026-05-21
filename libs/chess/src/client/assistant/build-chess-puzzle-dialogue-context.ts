import type {
  AssistantSpeakAction,
  DialogueContext,
} from '@gamezilla/assistant/shared';

import { boardOrientationFromFen } from '../../shared/chess-puzzle-fsm';

export type ChessPuzzleDialogueBoardContext = {
  readonly orientation: 'white' | 'black';
  readonly displayFen: string | null;
  readonly solveIdx: number;
  readonly totalTokens: number;
  readonly wrongFromSquare: string | null;
  readonly wrongToSquare: string | null;
  readonly puzzleRating?: number;
  readonly themes?: readonly string[];
};

function movesPlayedSummary(board: ChessPuzzleDialogueBoardContext): {
  readonly movesPlayed: number;
  readonly movesTotal: number;
} {
  const total = Math.max(0, Math.floor((board.totalTokens - 1) / 2));
  const playedRaw = Math.floor(board.solveIdx / 2);
  const played = Math.max(0, Math.min(total, playedRaw));
  return { movesPlayed: played, movesTotal: total };
}

function sideToMove(
  bucket: string,
  board: ChessPuzzleDialogueBoardContext
): string {
  if (board.displayFen === null) return 'unknown';
  if (bucket === 'solved') return 'none';
  return boardOrientationFromFen(board.displayFen);
}

function wrongSquares(
  bucket: string,
  board: ChessPuzzleDialogueBoardContext
): { readonly wrongFrom: string; readonly wrongTo: string } {
  const show = bucket === 'wrong' || bucket === 'retry';
  return {
    wrongFrom: show ? (board.wrongFromSquare ?? '') : '',
    wrongTo: show ? (board.wrongToSquare ?? '') : '',
  };
}

function normalizedRating(rating: number | undefined): number | null {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) {
    return null;
  }
  return Math.round(rating);
}

export function buildChessPuzzleDialogueContext(args: {
  readonly action: AssistantSpeakAction;
  readonly board: ChessPuzzleDialogueBoardContext;
}): DialogueContext {
  const key = args.action.dialogueKey;
  const bucket = key?.bucket ?? 'fallback';
  const { movesPlayed, movesTotal } = movesPlayedSummary(args.board);
  const { wrongFrom, wrongTo } = wrongSquares(bucket, args.board);
  return {
    playerColour: args.board.orientation,
    sideToMove: sideToMove(bucket, args.board),
    movesPlayed,
    movesTotal,
    wrongFrom,
    wrongTo,
    theme: key?.theme ?? '',
    themesAll: (args.board.themes ?? []).join('|'),
    puzzleRating: normalizedRating(args.board.puzzleRating),
  };
}
