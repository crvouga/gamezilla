import { Assert } from '@gamezilla/lib/assert';
import type { Message } from '@gamezilla/lib/message';
import type { State } from '../../store/types';
import { readBoard, readSeat } from './tic-tac-toe-domain';

const crash: Assert = Assert.crash();

export function reduceMarkPlaced(
  state: State,
  msg: Message<{ cell: number; player: 'X' | 'O'; seq: number }>
): State {
  const payload = msg.payload;
  crash.record(payload, 'MARK_PLACED payload must be a record');
  crash.field(payload, 'cell', 'MARK_PLACED must have cell');
  crash.field(payload, 'player', 'MARK_PLACED must have player');
  crash.field(payload, 'seq', 'MARK_PLACED must have seq');

  const boardSrc = readBoard(state);
  const board: Array<null | string> = [];
  for (let i = 0; i < 9; i++) {
    const c = boardSrc[i];
    crash.ok(
      c === null || c === 'X' || c === 'O',
      'board cell must be null, X, or O'
    );
    board.push(c);
  }
  const cell = payload.cell;
  const player = payload.player;
  crash.number(cell, 'MARK_PLACED cell must be a finite number');
  crash.ok(
    Number.isInteger(cell) && cell >= 0 && cell <= 8,
    'MARK_PLACED cell must be integer 0..8'
  );
  crash.string(player, 'MARK_PLACED player must be string');
  crash.ok(
    player === 'X' || player === 'O',
    'MARK_PLACED player must be X or O'
  );
  board[cell] = player;

  const next_turn = player === 'X' ? 'O' : 'X';
  const seqVal = payload.seq;
  crash.number(seqVal, 'MARK_PLACED seq must be a finite number');
  const result: State = {
    ...state,
    board,
    currentTurn: next_turn,
    seq: seqVal,
  };

  crash.ok(
    result['currentTurn'] === 'X' || result['currentTurn'] === 'O',
    'reduce postcondition: currentTurn must be X or O'
  );
  return result;
}

export function reduceGameWon(
  state: State,
  msg: Message<{ winner: 'X' | 'O'; seq: number }>
): State {
  const payload = msg.payload;
  crash.record(payload, 'GAME_WON payload must be a record');
  crash.field(payload, 'winner', 'GAME_WON must have winner');
  crash.field(payload, 'seq', 'GAME_WON must have seq');
  const seqVal = payload.seq;
  crash.number(seqVal, 'GAME_WON seq must be a finite number');

  return {
    ...state,
    winner: payload.winner,
    status: 'completed',
    seq: seqVal,
    clockStatus: 'finished',
  };
}

export function reduceGameDrawn(state: State, msg: Message<{ seq: number }>): State {
  const payload = msg.payload;
  crash.record(payload, 'GAME_DRAWN payload must be a record');
  crash.field(payload, 'seq', 'GAME_DRAWN must have seq');
  const seqVal = payload.seq;
  crash.number(seqVal, 'GAME_DRAWN seq must be a finite number');

  return {
    ...state,
    winner: 'draw',
    status: 'completed',
    seq: seqVal,
    clockStatus: 'finished',
  };
}

export function reducePlayerResigned(
  state: State,
  msg: Message<{ player: 'X' | 'O'; seq: number }>
): State {
  const payload = msg.payload;
  crash.record(payload, 'PLAYER_RESIGNED payload must be a record');
  crash.field(payload, 'player', 'PLAYER_RESIGNED must have player');
  crash.field(payload, 'seq', 'PLAYER_RESIGNED must have seq');

  const player = payload.player;
  crash.string(player, 'PLAYER_RESIGNED player must be string');
  crash.ok(
    player === 'X' || player === 'O',
    'PLAYER_RESIGNED player must be X or O'
  );
  const winner = player === 'X' ? 'O' : 'X';
  const seqVal = payload.seq;
  crash.number(seqVal, 'PLAYER_RESIGNED seq must be a finite number');

  return {
    ...state,
    winner,
    status: 'completed',
    seq: seqVal,
    clockStatus: 'finished',
  };
}

export function reduceSeatClaimed(
  state: State,
  msg: Message<{ mark: 'X' | 'O'; peerId: string; seq: number }>
): State {
  const payload = msg.payload;
  crash.record(payload, 'SEAT_CLAIMED payload must be a record');
  crash.field(payload, 'mark', 'SEAT_CLAIMED must have mark');
  crash.field(payload, 'peerId', 'SEAT_CLAIMED must have peerId');
  crash.field(payload, 'seq', 'SEAT_CLAIMED must have seq');
  const markRaw = payload.mark;
  crash.ok(
    markRaw === 'X' || markRaw === 'O',
    'SEAT_CLAIMED mark must be X or O'
  );
  const mark = markRaw;
  crash.string(payload.peerId, 'SEAT_CLAIMED peerId must be string');
  const seqVal = payload.seq;
  crash.number(seqVal, 'SEAT_CLAIMED seq must be a finite number');
  const seatKey = mark === 'X' ? 'seatX' : 'seatO';
  return {
    ...state,
    [seatKey]: payload.peerId,
    seq: seqVal,
  };
}

export function reduceSeatReleased(
  state: State,
  msg: Message<{ mark: 'X' | 'O'; peerId: string; seq: number }>
): State {
  const payload = msg.payload;
  crash.record(payload, 'SEAT_RELEASED payload must be a record');
  crash.field(payload, 'mark', 'SEAT_RELEASED must have mark');
  crash.field(payload, 'peerId', 'SEAT_RELEASED must have peerId');
  crash.field(payload, 'seq', 'SEAT_RELEASED must have seq');
  const markRaw = payload.mark;
  crash.ok(
    markRaw === 'X' || markRaw === 'O',
    'SEAT_RELEASED mark must be X or O'
  );
  const mark = markRaw;
  crash.string(payload.peerId, 'SEAT_RELEASED peerId must be string');
  const seqVal = payload.seq;
  crash.number(seqVal, 'SEAT_RELEASED seq must be a finite number');
  const seatKey = mark === 'X' ? 'seatX' : 'seatO';
  const prev = readSeat(state, seatKey, seatKey);
  const cleared = prev === payload.peerId ? null : prev;
  return {
    ...state,
    [seatKey]: cleared,
    seq: seqVal,
  };
}

export function reduceForfeitWin(
  state: State,
  msg: Message<{ winner: 'X' | 'O'; seq: number }>
): State {
  const payload = msg.payload;
  crash.record(payload, 'FORFEIT_WIN payload must be a record');
  crash.field(payload, 'winner', 'FORFEIT_WIN must have winner');
  crash.field(payload, 'seq', 'FORFEIT_WIN must have seq');
  const w = payload.winner;
  crash.string(w, 'FORFEIT_WIN winner must be string');
  crash.ok(w === 'X' || w === 'O', 'FORFEIT_WIN winner must be X or O');
  const seqVal = payload.seq;
  crash.number(seqVal, 'FORFEIT_WIN seq must be a finite number');
  return {
    ...state,
    winner: w,
    status: 'completed',
    seq: seqVal,
    clockStatus: 'finished',
  };
}

export function reduceClockSliceSet(
  state: State,
  msg: Message<{
    remainingMsX: number;
    remainingMsO: number;
    activePlayer: 'X' | 'O';
    seq: number;
  }>
): State {
  const payload = msg.payload;
  crash.record(payload, 'CLOCK_SLICE_SET payload must be a record');
  const seqVal = payload.seq;
  crash.number(seqVal, 'CLOCK_SLICE_SET seq must be a finite number');
  return {
    ...state,
    remainingMsX: payload.remainingMsX,
    remainingMsO: payload.remainingMsO,
    clockActivePlayer: payload.activePlayer,
    clockStatus: 'running',
    seq: seqVal,
  };
}

export function reduceClockTimeout(
  state: State,
  msg: Message<{
    loser: 'X' | 'O';
    winner: 'X' | 'O';
    atMs: number;
    seq: number;
  }>
): State {
  const payload = msg.payload;
  crash.record(payload, 'CLOCK_TIMEOUT payload must be a record');
  const seqVal = payload.seq;
  crash.number(seqVal, 'CLOCK_TIMEOUT seq must be a finite number');
  return {
    ...state,
    winner: payload.winner,
    status: 'completed',
    seq: seqVal,
    clockStatus: 'finished',
  };
}
