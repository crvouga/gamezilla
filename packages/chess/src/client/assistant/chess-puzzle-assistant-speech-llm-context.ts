import type {
  AssistantSpeechHistoryLine,
  AssistantSpeechLlmContext,
} from '@gamezilla/assistant/shared';

import { boardOrientationFromFen } from '../../shared/chess-puzzle-fsm';
import { parseChessPuzzleAssistantRef } from './chess-puzzle-assistant-ref';

const PERSONA =
  'You are a friendly chess coach helping one player solve a tactical puzzle. Address them in the second person ("you", "your"). Speak about THIS specific position, not chess in general.';

const GROUNDING =
  'The board state below is the source of truth: ground every reference in it. ' +
  'orientation is the colour the player is sitting on; sideToMove is whose turn it is right now in displayFen; movesPlayed/movesTotal is the player\'s progress through the solution line. ' +
  'You may say "white"/"black", reference the player\'s own pieces by colour, mention which move number this is, and (only on bucket=wrong or bucket=retry) reference the squares the player just tried (wrongFrom→wrongTo). ' +
  'NEVER reveal, hint at, or describe the next correct move — not its squares, not the piece, not the direction, not the tactical mechanic in concrete board terms. Only generic encouragement / framing. ' +
  'Name a tactic (fork, pin, skewer, exposed king, hanging piece, etc.) ONLY when themeId is that exact tactic, and even then never describe the specific squares involved. ' +
  'puzzleCatalogThemes is informational only — do not surface unrelated tags. ' +
  'Do not invent board facts beyond what the identifiers state. If a fact is not in the identifiers, do not say it.';

const COMPLETION_RULE =
  'Completion-style praise (Great job!, Well done!, Nailed it!, etc.) is only allowed when bucket=solved.';

const VARIETY_RULE =
  'Phrasing variety: pick fresh wording each turn — vary openers, verbs, and structure. Avoid recycling the same template phrases or repeating recent history lines.';

const SPOILER_RULE =
  'Spoiler guard: if you would mention the destination of the next correct move, the piece that should move, or how the tactic resolves on this board, stop and pick a less specific phrasing.';

/**
 * Per-bucket tone. Kept to one short line each so the model has room to vary
 * phrasing; specifics (correct vs incorrect, etc.) come from `lastMoveOutcome`
 * in identifiers rather than long forbidden-word lists.
 */
function chessPuzzleTone(bucket: string): string {
  switch (bucket) {
    case 'start':
    case 'announce':
      return 'Tone: opening cue — invite them to look for the idea in this position. Never sound like a redo.';
    case 'wrong':
      return 'Tone: their last move missed — brief, kind nudge that names the squares they tried (wrongFrom→wrongTo) and asks them to look again. Never treat the missed move as good.';
    case 'retry':
      return 'Tone: they just hit retry — short reset cue ("try again", "fresh look"). Never treat the missed move as good.';
    case 'progress':
      return 'Tone: their last move was correct and the line continues — tiny ack or forward cue (e.g. "keep going"). Never sound like a redo or a final celebration.';
    case 'solved':
      return 'Tone: the puzzle is finished — brief, warm closer. Never sound like a redo.';
    case 'fallback':
      return 'Tone: edge case — gently suggest moving on.';
    default:
      return 'Tone: follow lastMoveOutcome — success beats and miss beats must not blur.';
  }
}

function lastMoveOutcomeForBucket(bucket: string): string {
  switch (bucket) {
    case 'progress':
      return 'correct_partial';
    case 'wrong':
      return 'incorrect';
    case 'retry':
      return 'incorrect_retry';
    case 'solved':
      return 'correct_complete';
    case 'start':
    case 'announce':
      return 'none_opening';
    case 'fallback':
      return 'unknown_neutral';
    default:
      return 'unknown';
  }
}

export type ChessPuzzleSpeechBoardContext = {
  readonly orientation: 'white' | 'black';
  readonly displayFen: string | null;
  readonly solveIdx: number;
  readonly totalTokens: number;
  readonly wrongFromSquare: string | null;
  readonly wrongToSquare: string | null;
  readonly puzzleRating?: number;
};

function sideToMoveFor(
  bucket: string,
  board: ChessPuzzleSpeechBoardContext | undefined
): string {
  if (board === undefined || board.displayFen === null) return 'unknown';
  if (bucket === 'solved') return 'none_finished';
  return boardOrientationFromFen(board.displayFen);
}

/**
 * Player progress through the solution line, expressed as moves the player
 * has actually made (the puzzle's first token is always the opponent's
 * canned move). Returns `unknown` when totals aren't available.
 */
function movesPlayedSummary(
  board: ChessPuzzleSpeechBoardContext | undefined
): string {
  if (board === undefined) return 'movesPlayed=unknown, movesTotal=unknown';
  const total = Math.max(0, Math.floor((board.totalTokens - 1) / 2));
  const playedRaw = Math.floor(board.solveIdx / 2);
  const played = Math.max(0, Math.min(total, playedRaw));
  return `movesPlayed=${played}, movesTotal=${total}`;
}

function wrongAttemptSegment(
  bucket: string,
  board: ChessPuzzleSpeechBoardContext | undefined
): string {
  if (board === undefined) return '';
  if (bucket !== 'wrong' && bucket !== 'retry') return '';
  const { wrongFromSquare, wrongToSquare } = board;
  if (wrongFromSquare === null || wrongToSquare === null) return '';
  return `, wrongFrom=${wrongFromSquare}, wrongTo=${wrongToSquare}`;
}

function ratingSegment(
  board: ChessPuzzleSpeechBoardContext | undefined
): string {
  const rating = board?.puzzleRating;
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) {
    return '';
  }
  return `, puzzleRating=${Math.round(rating)}`;
}

function buildIdentifiers(args: {
  readonly bucket: string;
  readonly outcome: string;
  readonly theme: string;
  readonly variation: number;
  readonly catalogStr: string;
  readonly payloadRef: string;
  readonly board: ChessPuzzleSpeechBoardContext | undefined;
}): string {
  const { bucket, outcome, theme, variation, catalogStr, payloadRef, board } =
    args;
  const orientation = board?.orientation ?? 'unknown';
  const sideToMove = sideToMoveFor(bucket, board);
  const movesSummary = movesPlayedSummary(board);
  const wrongSeg = wrongAttemptSegment(bucket, board);
  const ratingSeg = ratingSegment(board);
  return (
    `moment=${bucket}, lastMoveOutcome=${outcome}, themeId=${theme}, ` +
    `lineVariant=${variation}, puzzleCatalogThemes=${catalogStr}, ` +
    `playerColour=${orientation}, sideToMove=${sideToMove}, ${movesSummary}` +
    `${wrongSeg}${ratingSeg}, payloadRef=${payloadRef}.`
  );
}

export function buildChessPuzzleSpeechLlmContext(args: {
  readonly payloadRef: string;
  readonly catalogThemes: readonly string[];
  readonly recentLines?: readonly AssistantSpeechHistoryLine[];
  readonly board?: ChessPuzzleSpeechBoardContext;
}): AssistantSpeechLlmContext | undefined {
  const parsed = parseChessPuzzleAssistantRef(args.payloadRef);
  if (parsed === null) {
    return undefined;
  }
  const catalogStr =
    args.catalogThemes.length > 0 ? args.catalogThemes.join('|') : 'none';
  const outcome = lastMoveOutcomeForBucket(parsed.bucket);
  const recent = args.recentLines;
  const identifiers = buildIdentifiers({
    bucket: parsed.bucket,
    outcome,
    theme: parsed.theme,
    variation: parsed.variation,
    catalogStr,
    payloadRef: args.payloadRef,
    board: args.board,
  });
  return {
    persona: PERSONA,
    grounding: GROUNDING,
    tone: chessPuzzleTone(parsed.bucket),
    rules: [COMPLETION_RULE, VARIETY_RULE, SPOILER_RULE],
    ...(recent !== undefined && recent.length > 0
      ? { history: { recentLines: recent } }
      : {}),
    identifiers,
  };
}
