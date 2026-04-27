import type { Message } from '@gamezilla/lib/message';
import type { Event } from '../../events/message-types';
import type { Command, HandleResult, State } from '../../store/types';
import {
  assertPeerOwnsMark,
  assertValidState,
  buildPlaceMarkEvents,
  buildTickClockEvents,
  isTerminalEvent,
  maybeBuildClockSwitchEvents,
  readBoardCells,
  readClockTickInputs,
  readSeat,
  seatsFullyClaimed,
  validatePlaceMarkInputs,
} from './tic-tac-toe-domain';
import {
  AlreadySeatedError,
  CellOccupiedError,
  ForfeitWin,
  GameOverError,
  InvalidMarkError,
  InvalidPayloadError,
  InvalidPlayerError,
  InvalidStateError,
  isFiniteNonNegative,
  NotSeatedError,
  PlayerResigned,
  reject,
  SeatClaimed,
  SeatReleased,
  SeatTakenError,
} from './tic-tac-toe-messages';

export function handlePlaceMark(
  state: State,
  command: Command,
  msg: Message<{ cell: number; player: 'X' | 'O' }>
): HandleResult {
  assertValidState(state);

  const cell = msg.payload.cell;
  const player = msg.payload.player;

  const inputErr = validatePlaceMarkInputs(state, cell, player);
  if (inputErr !== null) return inputErr;

  const seatErr = assertPeerOwnsMark(state, command, player);
  if (seatErr !== null) return seatErr;

  const boardOrErr = readBoardCells(state);
  if (!Array.isArray(boardOrErr)) return boardOrErr;
  const boardCells = boardOrErr;

  if (boardCells[cell] !== null) {
    return reject(CellOccupiedError({ cell }));
  }

  const seqRaw = state['seq'];
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return reject(InvalidStateError({}));
  }
  const next_seq = seqRaw + 1;
  const events = buildPlaceMarkEvents(boardCells, cell, player, next_seq);
  const willRemainInProgress = !events.some(isTerminalEvent);
  if (willRemainInProgress && seatsFullyClaimed(state)) {
    const nextTurn = player === 'X' ? 'O' : 'X';
    const clockEvents = maybeBuildClockSwitchEvents(
      state,
      nextTurn,
      next_seq + events.length
    );
    events.push(...clockEvents);
  }

  return { ok: true, events };
}

export function handleTickClock(
  state: State,
  msg: Message<{ elapsedMs: number }>
): HandleResult {
  assertValidState(state);
  const elapsedMs = msg.payload.elapsedMs;
  const inputs = readClockTickInputs(state, elapsedMs);
  if (!inputs) {
    if (!isFiniteNonNegative(elapsedMs) || elapsedMs <= 0) {
      return reject(InvalidPayloadError({}));
    }
    if (state['status'] === 'completed') return reject(GameOverError({}));
    return reject(InvalidStateError({}));
  }
  const events = buildTickClockEvents(inputs, elapsedMs);
  return {
    ok: true,
    events,
  };
}

export function handleResign(
  state: State,
  command: Command,
  msg: Message<{ player: 'X' | 'O' }>
): HandleResult {
  assertValidState(state);

  const player = msg.payload.player;

  if (player !== 'X' && player !== 'O') {
    return reject(InvalidPlayerError({ got: String(player) }));
  }
  if (state['status'] === 'completed') {
    return reject(GameOverError({}));
  }

  const seatErr = assertPeerOwnsMark(state, command, player);
  if (seatErr !== null) {
    return seatErr;
  }

  const seqRaw = state['seq'];
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return reject(InvalidStateError({}));
  }
  const next_seq = seqRaw + 1;
  return {
    ok: true,
    events: [PlayerResigned({ player, seq: next_seq })],
  };
}

function validateSeatAvailability(
  state: State,
  peerId: string,
  mark: 'X' | 'O'
): HandleResult | null {
  const seatX = readSeat(state, 'seatX', 'seatX');
  const seatO = readSeat(state, 'seatO', 'seatO');

  const otherSeat = mark === 'X' ? seatO : seatX;
  if (otherSeat === peerId) {
    return reject(AlreadySeatedError({}));
  }

  const mySeat = mark === 'X' ? seatX : seatO;
  if (mySeat !== null && mySeat !== peerId) {
    return reject(SeatTakenError({ mark }));
  }
  return null;
}

export function handleJoinSession(
  state: State,
  command: Command,
  msg: Message<{ mark: 'X' | 'O' }>
): HandleResult {
  assertValidState(state);

  const mark = msg.payload.mark;

  if (mark !== 'X' && mark !== 'O') {
    return reject(InvalidMarkError({ got: String(mark) }));
  }
  if (state['status'] === 'completed') {
    return reject(GameOverError({}));
  }

  const seatErr = validateSeatAvailability(state, command.peerId, mark);
  if (seatErr !== null) return seatErr;

  const seqRaw = state['seq'];
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return reject(InvalidStateError({}));
  }
  const next_seq = seqRaw + 1;

  return {
    ok: true,
    events: [SeatClaimed({ mark, peerId: command.peerId, seq: next_seq })],
  };
}

function isPlainObjectPayload(rawPayload: unknown): boolean {
  return (
    rawPayload !== null &&
    typeof rawPayload === 'object' &&
    !Array.isArray(rawPayload)
  );
}

function collectHeldSeats(state: State, peerId: string): Array<'X' | 'O'> {
  const seatX = readSeat(state, 'seatX', 'seatX');
  const seatO = readSeat(state, 'seatO', 'seatO');
  const held: Array<'X' | 'O'> = [];
  if (seatX === peerId) held.push('X');
  if (seatO === peerId) held.push('O');
  return held;
}

function maybeAddForfeitWin(
  state: State,
  held: Array<'X' | 'O'>,
  seq: number
): { event: Event; nextSeq: number } | null {
  if (state['status'] !== 'in_progress') return null;
  if (!seatsFullyClaimed(state)) return null;

  const seatX = readSeat(state, 'seatX', 'seatX');
  const seatO = readSeat(state, 'seatO', 'seatO');
  const nextSeatX = held.includes('X') ? null : seatX;
  const nextSeatO = held.includes('O') ? null : seatO;

  const oneRemains =
    (nextSeatX !== null && nextSeatO === null) ||
    (nextSeatX === null && nextSeatO !== null);
  if (!oneRemains) return null;

  const winner: 'X' | 'O' = nextSeatX !== null ? 'X' : 'O';
  return { event: ForfeitWin({ winner, seq }), nextSeq: seq + 1 };
}

export function handleLeaveSession(
  state: State,
  command: Command
): HandleResult {
  assertValidState(state);

  if (!isPlainObjectPayload(command.message.payload)) {
    return reject(InvalidPayloadError({}));
  }

  const peerId = command.peerId;
  const held = collectHeldSeats(state, peerId);
  if (held.length === 0) {
    return reject(NotSeatedError({}));
  }

  const seqRaw = state['seq'];
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return reject(InvalidStateError({}));
  }

  const events: Event[] = [];
  let seq = seqRaw + 1;
  for (const mark of held) {
    events.push(SeatReleased({ mark, peerId, seq }));
    seq += 1;
  }

  const forfeit = maybeAddForfeitWin(state, held, seq);
  if (forfeit !== null) {
    events.push(forfeit.event);
    seq = forfeit.nextSeq;
  }

  return { ok: true, events };
}
