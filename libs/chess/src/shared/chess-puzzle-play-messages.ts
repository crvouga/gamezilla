import { createMessageNamespace, isPlainRecord } from '@pkgs/message';

import type { ChessPuzzleOrientation } from './chess-puzzle-fsm';
import {
  type ChessPuzzlePlayStatus,
  isNonEmptyString,
  isNonNegativeInteger,
  isNullOrNonEmptyString,
  isOrientation,
  isStatus,
} from './chess-puzzle-play-attr';

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

function validateSubmitMovePayload(
  payload: unknown
): payload is { uci: string } {
  if (!isPlainRecord(payload)) return false;
  const uci = payload['uci'];
  if (typeof uci !== 'string') return false;
  const t = uci.trim();
  return t.length >= 4 && t.length <= 5;
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
  orientation: ChessPuzzleOrientation;
  status: ChessPuzzlePlayStatus;
  solveIdx: number;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['puzzleId']) &&
    isNonEmptyString(payload['fen']) &&
    isNonEmptyString(payload['moves']) &&
    isNonEmptyString(payload['hostIdentity']) &&
    isNullOrNonEmptyString(payload['displayFen']) &&
    isOrientation(payload['orientation']) &&
    isStatus(payload['status']) &&
    isNonNegativeInteger(payload['solveIdx'])
  );
}

function validateMoveAcceptedPayload(payload: unknown): payload is {
  uci: string;
  displayFen: string;
  solveIdx: number;
  status: ChessPuzzlePlayStatus;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['uci']) &&
    isNonEmptyString(payload['displayFen']) &&
    isNonNegativeInteger(payload['solveIdx']) &&
    isStatus(payload['status'])
  );
}

function validateMoveRejectedPayload(payload: unknown): payload is {
  uci: string;
  layoutKey: number;
  wrongFromSquare: string;
  wrongToSquare: string;
  /** FEN after the wrong move was applied; what the board now renders. */
  displayFen: string;
  /** FEN before the wrong move; what `Retry` should restore. */
  previousDisplayFen: string;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['uci']) &&
    isNonNegativeInteger(payload['layoutKey']) &&
    isNonEmptyString(payload['wrongFromSquare']) &&
    isNonEmptyString(payload['wrongToSquare']) &&
    isNonEmptyString(payload['displayFen']) &&
    isNonEmptyString(payload['previousDisplayFen'])
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
  status: ChessPuzzlePlayStatus;
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
  status: ChessPuzzlePlayStatus;
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

export const chessPuzzlePlayCmdNs = createMessageNamespace(
  'chess-puzzle-play-cmd'
);

/**
 * Begin a puzzle solving session. The dispatcher's identity is captured into
 * host identity on success — that identity is the only one allowed to
 * subsequently submit moves, reset, or clear.
 */
export const StartChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'start',
  validateStartPayload
);

/** Host attempts the next move in the solution line. */
export const SubmitChessPuzzleMove = chessPuzzlePlayCmdNs(
  'submit-move',
  validateSubmitMovePayload
);

/** Host rewinds to the post-opening position and clears `wrong` / `solved` status. */
export const ResetChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'reset',
  validateEmptyPayload
);

/** Host steps back one solved host-turn (rewinds room state into `solving`). */
export const StepBackChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'step-back',
  validateEmptyPayload
);

/**
 * Host steps forward along already-attempted solution plies (up to
 * `furthestSolveIdx`).
 */
export const StepForwardChessPuzzlePlay = chessPuzzlePlayCmdNs(
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
export const SeekChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'seek',
  validateSeekPayload
);

/** Tear down the session entirely (returns all attrs to defaults). */
export const ClearChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'clear',
  validateEmptyPayload
);

/** Host requests a hint for the current expected move. */
export const RequestChessPuzzleHint = chessPuzzlePlayCmdNs(
  'request-hint',
  validateEmptyPayload
);

/**
 * Take over an in-progress puzzle session when the recorded host identity is
 * stale (e.g. after sign-in changes replication id from device to account).
 */
export const ReclaimChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'reclaim',
  validateEmptyPayload
);

export const chessPuzzlePlayEvtNs = createMessageNamespace(
  'chess-puzzle-play-evt'
);

export const ChessPuzzlePlayStarted = chessPuzzlePlayEvtNs(
  'started',
  validateStartedPayload
);

export const ChessPuzzlePlayMoveAccepted = chessPuzzlePlayEvtNs(
  'move-accepted',
  validateMoveAcceptedPayload
);

export const ChessPuzzlePlayMoveRejected = chessPuzzlePlayEvtNs(
  'move-rejected',
  validateMoveRejectedPayload
);

export const ChessPuzzlePlayResetEvt = chessPuzzlePlayEvtNs(
  'reset',
  validateResetEvtPayload
);

export const ChessPuzzlePlayStepped = chessPuzzlePlayEvtNs(
  'stepped',
  validateSteppedPayload
);

export const ChessPuzzlePlayCleared = chessPuzzlePlayEvtNs(
  'cleared',
  validateEmptyPayload
);

export const ChessPuzzleHintRevealed = chessPuzzlePlayEvtNs(
  'hint-revealed',
  validateHintRevealedPayload
);

function validateHostReclaimedPayload(
  payload: unknown
): payload is { hostIdentity: string } {
  if (!isPlainRecord(payload)) return false;
  return isNonEmptyString(payload['hostIdentity']);
}

export const ChessPuzzleHostReclaimed = chessPuzzlePlayEvtNs(
  'host-reclaimed',
  validateHostReclaimedPayload
);
