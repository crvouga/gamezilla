import { createNamespace, isPlainRecord } from '@gamezilla/lib/message';
import type { HandleResult } from '../../store/types';
import type { StoreError } from '../../events/message-types';

/** Per-player budget for chess-style clocks (fixture default; tests rely on this). */
export const TIC_TAC_TOE_CLOCK_MS_PER_PLAYER = 5000;

function isMark(v: unknown): v is 'X' | 'O' {
  return v === 'X' || v === 'O';
}

function isCellIndex(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 8;
}

function isLogSeq(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isNonEmptyPeerId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function validatePlaceMarkPayload(
  p: unknown
): p is { cell: number; player: 'X' | 'O' } {
  if (!isPlainRecord(p)) return false;
  return isCellIndex(p['cell']) && isMark(p['player']);
}

function validateResignPayload(p: unknown): p is { player: 'X' | 'O' } {
  if (!isPlainRecord(p)) return false;
  return isMark(p['player']);
}

function validateJoinSessionPayload(p: unknown): p is { mark: 'X' | 'O' } {
  if (!isPlainRecord(p)) return false;
  return isMark(p['mark']);
}

function validateLeaveSessionPayload(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

function validateTickClockPayload(p: unknown): p is { elapsedMs: number } {
  if (!isPlainRecord(p)) return false;
  const elapsedMs = p['elapsedMs'];
  return (
    typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs > 0
  );
}

function validateMarkPlacedPayload(
  p: unknown
): p is { cell: number; player: 'X' | 'O'; seq: number } {
  if (!isPlainRecord(p)) return false;
  return isCellIndex(p['cell']) && isMark(p['player']) && isLogSeq(p['seq']);
}

function validateGameWonPayload(
  p: unknown
): p is { winner: 'X' | 'O'; seq: number } {
  if (!isPlainRecord(p)) return false;
  return isMark(p['winner']) && isLogSeq(p['seq']);
}

function validateGameDrawnPayload(p: unknown): p is { seq: number } {
  if (!isPlainRecord(p)) return false;
  return isLogSeq(p['seq']);
}

function validatePlayerResignedPayload(
  p: unknown
): p is { player: 'X' | 'O'; seq: number } {
  if (!isPlainRecord(p)) return false;
  return isMark(p['player']) && isLogSeq(p['seq']);
}

function validateSeatClaimedPayload(
  p: unknown
): p is { mark: 'X' | 'O'; peerId: string; seq: number } {
  if (!isPlainRecord(p)) return false;
  return (
    isMark(p['mark']) && isNonEmptyPeerId(p['peerId']) && isLogSeq(p['seq'])
  );
}

function validateSeatReleasedPayload(
  p: unknown
): p is { mark: 'X' | 'O'; peerId: string; seq: number } {
  if (!isPlainRecord(p)) return false;
  return (
    isMark(p['mark']) && isNonEmptyPeerId(p['peerId']) && isLogSeq(p['seq'])
  );
}

function validateForfeitWinPayload(
  p: unknown
): p is { winner: 'X' | 'O'; seq: number } {
  if (!isPlainRecord(p)) return false;
  return isMark(p['winner']) && isLogSeq(p['seq']);
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isFiniteNonNegative(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0;
}

function validateClockSliceSetPayload(p: unknown): p is {
  remainingMsX: number;
  remainingMsO: number;
  activePlayer: 'X' | 'O';
  seq: number;
} {
  if (!isPlainRecord(p)) return false;
  return (
    isFiniteNonNegative(p['remainingMsX']) &&
    isFiniteNonNegative(p['remainingMsO']) &&
    isMark(p['activePlayer']) &&
    isLogSeq(p['seq'])
  );
}

function validateClockTimeoutPayload(p: unknown): p is {
  loser: 'X' | 'O';
  winner: 'X' | 'O';
  atMs: number;
  seq: number;
} {
  if (!isPlainRecord(p)) return false;
  const loser = p['loser'];
  const winner = p['winner'];
  const atMs = p['atMs'];
  const sq = p['seq'];
  return (
    isMark(loser) &&
    isMark(winner) &&
    loser !== winner &&
    typeof atMs === 'number' &&
    Number.isFinite(atMs) &&
    isLogSeq(sq)
  );
}

export const cmdNs = createNamespace('ticTacToeCommand');
export const PlaceMark = cmdNs('PLACE_MARK', validatePlaceMarkPayload);
export const Resign = cmdNs('RESIGN', validateResignPayload);
export const JoinSession = cmdNs('JOIN_SESSION', validateJoinSessionPayload);
export const LeaveSession = cmdNs('LEAVE_SESSION', validateLeaveSessionPayload);
export const TickClock = cmdNs('TICK_CLOCK', validateTickClockPayload);

export const evtNs = createNamespace('ticTacToeEvent');
export const MarkPlaced = evtNs('MARK_PLACED', validateMarkPlacedPayload);
export const GameWon = evtNs('GAME_WON', validateGameWonPayload);
export const GameDrawn = evtNs('GAME_DRAWN', validateGameDrawnPayload);
export const PlayerResigned = evtNs(
  'PLAYER_RESIGNED',
  validatePlayerResignedPayload
);
export const SeatClaimed = evtNs('SEAT_CLAIMED', validateSeatClaimedPayload);
export const SeatReleased = evtNs('SEAT_RELEASED', validateSeatReleasedPayload);
export const ForfeitWin = evtNs('FORFEIT_WIN', validateForfeitWinPayload);
export const ClockSliceSet = evtNs(
  'CLOCK_SLICE_SET',
  validateClockSliceSetPayload
);
export const ClockTimeout = evtNs('CLOCK_TIMEOUT', validateClockTimeoutPayload);

const errTagNs = createNamespace('ticTacToeErr');

function validateErrEmpty(p: unknown): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0;
}

function validateErrGotString(p: unknown): p is { got: string } {
  if (!isPlainRecord(p)) return false;
  return typeof p['got'] === 'string';
}

function validateErrCellOccupied(p: unknown): p is { cell: number } {
  if (!isPlainRecord(p)) return false;
  const c = p['cell'];
  return typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 8;
}

function validateErrNotYourMark(p: unknown): p is {
  peerId: string;
  mark: 'X' | 'O';
} {
  if (!isPlainRecord(p)) return false;
  const pid = p['peerId'];
  const m = p['mark'];
  return typeof pid === 'string' && pid.length > 0 && isMark(m);
}

function validateErrSeatTaken(p: unknown): p is { mark: 'X' | 'O' } {
  if (!isPlainRecord(p)) return false;
  return isMark(p['mark']);
}

function validateErrUnknownCommand(p: unknown): p is { commandType: string } {
  if (!isPlainRecord(p)) return false;
  const t = p['commandType'];
  return typeof t === 'string' && t.length > 0;
}

/** Not this mark's turn to act. */
export const WrongTurnError = errTagNs('WRONG_TURN', validateErrEmpty);
export const CellOccupiedError = errTagNs(
  'CELL_OCCUPIED',
  validateErrCellOccupied
);
export const GameOverError = errTagNs('GAME_OVER', validateErrEmpty);
export const InvalidCellError = errTagNs('INVALID_CELL', validateErrGotString);
export const InvalidPlayerError = errTagNs(
  'INVALID_PLAYER',
  validateErrGotString
);
export const InvalidBoardError = errTagNs('INVALID_BOARD', validateErrEmpty);
export const InvalidStateError = errTagNs('INVALID_STATE', validateErrEmpty);
export const NotYourMarkError = errTagNs(
  'NOT_YOUR_MARK',
  validateErrNotYourMark
);
export const InvalidMarkError = errTagNs('INVALID_MARK', validateErrGotString);
export const AlreadySeatedError = errTagNs('ALREADY_SEATED', validateErrEmpty);
export const SeatTakenError = errTagNs('SEAT_TAKEN', validateErrSeatTaken);
export const InvalidPayloadError = errTagNs(
  'INVALID_PAYLOAD',
  validateErrEmpty
);
export const NotSeatedError = errTagNs('NOT_SEATED', validateErrEmpty);
export const UnknownCommandError = errTagNs(
  'UNKNOWN_COMMAND',
  validateErrUnknownCommand
);

export function reject(error: StoreError): HandleResult {
  return { ok: false, error };
}
