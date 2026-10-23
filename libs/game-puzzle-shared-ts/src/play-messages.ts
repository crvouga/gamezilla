import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { PuzzlePlayStatus } from './play-attr';
import {
  isNonEmptyString,
  isNonNegativeInteger,
  isNullOrNonEmptyString,
  isNullOrNonNegativeInteger,
  isSide,
  isStatus,
} from './play-attr';
import { isCellText } from './recommendations';

function validateStartPayload(
  payload: unknown
): payload is { puzzleId: string; fen: string; moves: string } {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['puzzleId']) &&
    isNonEmptyString(payload['fen']) &&
    isNonEmptyString(payload['moves'])
  );
}

/** The longest action a puzzle move may spell. */
const MAX_ACTION_LENGTH = 64;

function validateSubmitMovePayload(
  payload: unknown
): payload is { uci: string } {
  if (!isPlainRecord(payload)) return false;
  // The action is the game's own spelling; only the game's rules judge it.
  const uci = payload['uci'];
  if (typeof uci !== 'string') return false;
  const t = uci.trim();
  return t.length > 0 && t.length <= MAX_ACTION_LENGTH && !/\s/.test(t);
}

function validateEmptyPayload(
  payload: unknown
): payload is Record<string, never> {
  return isPlainRecord(payload) && Object.keys(payload).length === 0;
}

function validateStartedPayload(payload: unknown): payload is {
  puzzleId: string;
  fen: string;
  moves: string;
  hostIdentity: string;
  displayFen: string | null;
  orientation: GameSide;
  status: PuzzlePlayStatus;
  solveIdx: number;
  startedAtMs: number;
  attemptId: string;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['puzzleId']) &&
    isNonEmptyString(payload['fen']) &&
    isNonEmptyString(payload['moves']) &&
    isNonEmptyString(payload['hostIdentity']) &&
    isNullOrNonEmptyString(payload['displayFen']) &&
    isSide(payload['orientation']) &&
    isStatus(payload['status']) &&
    isNonNegativeInteger(payload['solveIdx']) &&
    isNonNegativeInteger(payload['startedAtMs']) &&
    isNonEmptyString(payload['attemptId'])
  );
}

function validateMoveAcceptedPayload(payload: unknown): payload is {
  uci: string;
  san: string;
  displayFen: string;
  solveIdx: number;
  status: PuzzlePlayStatus;
  endedAtMs: number | null;
  /** Line the room follows from here (rewritten on alternative mate / transposition). */
  moves: string;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['uci']) &&
    isNonEmptyString(payload['moves']) &&
    isNonEmptyString(payload['san']) &&
    isNonEmptyString(payload['displayFen']) &&
    isNonNegativeInteger(payload['solveIdx']) &&
    isStatus(payload['status']) &&
    isNullOrNonNegativeInteger(payload['endedAtMs'])
  );
}

function validateMoveRejectedPayload(payload: unknown): payload is {
  uci: string;
  san: string;
  layoutKey: number;
  wrongToSquare: string;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['uci']) &&
    isNonEmptyString(payload['san']) &&
    isNonNegativeInteger(payload['layoutKey']) &&
    isNonEmptyString(payload['wrongToSquare'])
  );
}

function validateHintRevealedPayload(payload: unknown): payload is {
  fromSquare: string;
  toSquare: string;
  layoutKey: number;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['fromSquare']) &&
    isNonEmptyString(payload['toSquare']) &&
    isNonNegativeInteger(payload['layoutKey'])
  );
}

function validateResetEvtPayload(payload: unknown): payload is {
  displayFen: string | null;
  solveIdx: number;
  furthestSolveIdx: number;
  status: PuzzlePlayStatus;
  layoutKey: number;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNullOrNonEmptyString(payload['displayFen']) &&
    isNonNegativeInteger(payload['solveIdx']) &&
    isNonNegativeInteger(payload['furthestSolveIdx']) &&
    isStatus(payload['status']) &&
    isNonNegativeInteger(payload['layoutKey'])
  );
}

function validateSteppedPayload(payload: unknown): payload is {
  displayFen: string;
  solveIdx: number;
  status: PuzzlePlayStatus;
  layoutKey: number;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['displayFen']) &&
    isNonNegativeInteger(payload['solveIdx']) &&
    isStatus(payload['status']) &&
    isNonNegativeInteger(payload['layoutKey'])
  );
}

function validateSolutionShownPayload(payload: unknown): payload is {
  displayFen: string;
  solveIdx: number;
  endedAtMs: number;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['displayFen']) &&
    isNonNegativeInteger(payload['solveIdx']) &&
    isNonNegativeInteger(payload['endedAtMs'])
  );
}

function validateSkippedEvtPayload(payload: unknown): payload is {
  endedAtMs: number;
} {
  if (!isPlainRecord(payload)) return false;
  return isNonNegativeInteger(payload['endedAtMs']);
}

function validateRecommendMovePayload(payload: unknown): payload is {
  from: string;
  to: string;
} {
  if (!isPlainRecord(payload)) return false;
  return isCellText(payload['from']) && isCellText(payload['to']);
}

function validateRecommendedPayload(payload: unknown): payload is {
  by: string;
  from: string;
  to: string;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['by']) &&
    isCellText(payload['from']) &&
    isCellText(payload['to'])
  );
}

function validateClearedPayload(payload: unknown): payload is { by: string } {
  if (!isPlainRecord(payload)) return false;
  return isNonEmptyString(payload['by']);
}

export const puzzlePlayCmdNs = createMessageNamespace('chess-puzzle-play-cmd');

/**
 * Begin a puzzle solving session. The dispatcher's identity is captured into
 * host identity on success — that identity is the only one allowed to
 * subsequently submit moves, reset, or clear.
 */
export const StartPuzzlePlay = puzzlePlayCmdNs('start', validateStartPayload);

/** Host attempts the next move in the solution line. */
export const SubmitPuzzleMove = puzzlePlayCmdNs(
  'submit-move',
  validateSubmitMovePayload
);

/** Host rewinds to the post-opening position and clears `wrong` / `solved` status. */
export const ResetPuzzlePlay = puzzlePlayCmdNs('reset', validateEmptyPayload);

/** Host steps back one ply (player or opponent) along the reached line. */
export const StepBackPuzzlePlay = puzzlePlayCmdNs(
  'step-back',
  validateEmptyPayload
);

/**
 * Host steps forward one ply along already-attempted solution plies (up to
 * `furthestSolveIdx`), including opponent replies.
 */
export const StepForwardPuzzlePlay = puzzlePlayCmdNs(
  'step-forward',
  validateEmptyPayload
);

function validateSeekPayload(
  payload: unknown
): payload is { solveIdx: number } {
  if (!isPlainRecord(payload)) return false;
  return isNonNegativeInteger(payload['solveIdx']);
}

/**
 * Host jumps to an already-reached solve index (move-list scrub). Clamped to
 * `[1, furthestSolveIdx]` by the router.
 */
export const SeekPuzzlePlay = puzzlePlayCmdNs('seek', validateSeekPayload);

/** Tear down the session entirely (returns all attrs to defaults). */
export const ClearPuzzlePlay = puzzlePlayCmdNs('clear', validateEmptyPayload);

/** Host requests a hint for the current expected move. */
export const RequestPuzzleHint = puzzlePlayCmdNs(
  'request-hint',
  validateEmptyPayload
);

/** Host promotes a hint highlight into a full solution arrow (synced). */
export const RevealPuzzleSolution = puzzlePlayCmdNs(
  'reveal-solution',
  validateEmptyPayload
);

/**
 * Take over an in-progress puzzle session when the recorded host identity is
 * stale (e.g. after sign-in changes replication id from device to account).
 */
export const ReclaimPuzzlePlay = puzzlePlayCmdNs(
  'reclaim',
  validateEmptyPayload
);

/**
 * Host asks to see the solution (§6): the rest of the line is played out and
 * the attempt enters review (`revealed`, terminal).
 */
export const ShowPuzzleSolution = puzzlePlayCmdNs(
  'show-solution',
  validateEmptyPayload
);

/** Host gives up on the current attempt without solving it (terminal). */
export const SkipPuzzlePlay = puzzlePlayCmdNs('skip', validateEmptyPayload);

/**
 * Any room member suggests a move for the live position. Suggestions are
 * annotations only — they never advance the puzzle.
 */
export const RecommendPuzzleMove = puzzlePlayCmdNs(
  'recommend-move',
  validateRecommendMovePayload
);

/** A member withdraws their own suggestion. */
export const ClearPuzzleRecommendation = puzzlePlayCmdNs(
  'clear-recommendation',
  validateEmptyPayload
);

export const puzzlePlayEvtNs = createMessageNamespace('chess-puzzle-play-evt');

export const PuzzlePlayStarted = puzzlePlayEvtNs(
  'started',
  validateStartedPayload
);

export const PuzzlePlayMoveAccepted = puzzlePlayEvtNs(
  'move-accepted',
  validateMoveAcceptedPayload
);

export const PuzzlePlayMoveRejected = puzzlePlayEvtNs(
  'move-rejected',
  validateMoveRejectedPayload
);

export const PuzzlePlayResetEvt = puzzlePlayEvtNs(
  'reset',
  validateResetEvtPayload
);

export const PuzzlePlayStepped = puzzlePlayEvtNs(
  'stepped',
  validateSteppedPayload
);

export const PuzzlePlayCleared = puzzlePlayEvtNs(
  'cleared',
  validateEmptyPayload
);

export const PuzzleHintRevealed = puzzlePlayEvtNs(
  'hint-revealed',
  validateHintRevealedPayload
);

export const PuzzleSolutionRevealed = puzzlePlayEvtNs(
  'solution-revealed',
  validateEmptyPayload
);

function validateHostReclaimedPayload(
  payload: unknown
): payload is { hostIdentity: string } {
  if (!isPlainRecord(payload)) return false;
  return isNonEmptyString(payload['hostIdentity']);
}

export const PuzzleHostReclaimed = puzzlePlayEvtNs(
  'host-reclaimed',
  validateHostReclaimedPayload
);

export const PuzzleSolutionShown = puzzlePlayEvtNs(
  'solution-shown',
  validateSolutionShownPayload
);

export const PuzzlePlaySkipped = puzzlePlayEvtNs(
  'skipped',
  validateSkippedEvtPayload
);

export const PuzzleMoveRecommended = puzzlePlayEvtNs(
  'move-recommended',
  validateRecommendedPayload
);

export const PuzzleRecommendationCleared = puzzlePlayEvtNs(
  'recommendation-cleared',
  validateClearedPayload
);
