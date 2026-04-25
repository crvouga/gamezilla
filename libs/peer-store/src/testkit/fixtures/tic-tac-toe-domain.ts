import { Assert } from '@gamezilla/lib/assert';
import type { Command, HandleResult, State } from '../../store/types';
import type { Event } from '../../events/message-types';
import {
  ClockSliceSet,
  ClockTimeout,
  GameDrawn,
  GameWon,
  ForfeitWin,
  InvalidBoardError,
  InvalidCellError,
  InvalidPlayerError,
  GameOverError,
  MarkPlaced,
  NotYourMarkError,
  PlayerResigned,
  TIC_TAC_TOE_CLOCK_MS_PER_PLAYER,
  WrongTurnError,
  isFiniteNonNegative,
  isFiniteNumber,
  reject,
} from './tic-tac-toe-messages';

const crash: Assert = Assert.crash();

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function checkWinner(board: Array<null | string>): null | string {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return board[a]!;
    }
  }
  return null;
}

function isBoardFull(board: Array<null | string>): boolean {
  return board.every((cell) => cell !== null);
}

export function readBoard(state: State): unknown[] {
  crash.field(state, 'board', 'state must have board');
  crash.array(state['board'], 'board must be an array');
  const b = state['board'];
  crash.ok(b.length === 9, 'board must have 9 cells');
  return b;
}

export function readSeat(
  state: State,
  key: 'seatX' | 'seatO',
  label: string
): null | string {
  crash.field(state, key, `state must have ${label}`);
  const v = state[key];
  if (v === null) {
    return null;
  }
  crash.string(v, `${label} must be string or null`);
  crash.nonEmptyString(v, `${label} must be non-empty when set`);
  return v;
}

export function seatsFullyClaimed(state: State): boolean {
  const x = readSeat(state, 'seatX', 'seatX');
  const o = readSeat(state, 'seatO', 'seatO');
  return x !== null && o !== null;
}

export function assertValidState(state: State): void {
  readBoard(state);
  readSeat(state, 'seatX', 'seatX');
  readSeat(state, 'seatO', 'seatO');
  crash.field(state, 'currentTurn', 'state must have currentTurn');
  crash.ok(
    state['currentTurn'] === 'X' || state['currentTurn'] === 'O',
    'currentTurn must be X or O'
  );
  crash.field(state, 'status', 'state must have status');
  crash.ok(
    state['status'] === 'in_progress' || state['status'] === 'completed',
    'status must be in_progress or completed'
  );
  crash.field(state, 'seq', 'state must have seq');
  crash.field(state, 'clockStatus', 'state must have clockStatus');
  const cs = state['clockStatus'];
  crash.ok(
    cs === 'idle' || cs === 'running' || cs === 'finished',
    'clockStatus must be idle, running, or finished'
  );
  crash.field(state, 'remainingMsX', 'state must have remainingMsX');
  crash.field(state, 'remainingMsO', 'state must have remainingMsO');
  crash.number(state['remainingMsX'], 'remainingMsX must be a finite number');
  crash.number(state['remainingMsO'], 'remainingMsO must be a finite number');
  crash.ok((state['remainingMsX'] as number) >= 0, 'remainingMsX must be >= 0');
  crash.ok((state['remainingMsO'] as number) >= 0, 'remainingMsO must be >= 0');
  crash.field(state, 'clockActivePlayer', 'state must have clockActivePlayer');
  const cap = state['clockActivePlayer'];
  crash.ok(
    cap === null || cap === 'X' || cap === 'O',
    'clockActivePlayer must be null, X, or O'
  );
}

export function assertPeerOwnsMark(
  state: State,
  command: Command,
  player: 'X' | 'O'
): HandleResult | null {
  if (!seatsFullyClaimed(state)) {
    return null;
  }
  const seatKey = player === 'X' ? 'seatX' : 'seatO';
  const expected = readSeat(state, seatKey, seatKey);
  if (expected !== command.peerId) {
    return reject(NotYourMarkError({ peerId: command.peerId, mark: player }));
  }
  return null;
}

export function validatePlaceMarkInputs(
  state: State,
  cell: number,
  player: 'X' | 'O'
): HandleResult | null {
  if (
    typeof cell !== 'number' ||
    cell < 0 ||
    cell > 8 ||
    !Number.isInteger(cell)
  ) {
    return reject(InvalidCellError({ got: String(cell) }));
  }
  if (player !== 'X' && player !== 'O') {
    return reject(InvalidPlayerError({ got: String(player) }));
  }
  if (state['status'] === 'completed') {
    return reject(GameOverError({}));
  }
  if (state['currentTurn'] !== player) {
    return reject(WrongTurnError({}));
  }
  return null;
}

export function readBoardCells(state: State): Array<null | string> | HandleResult {
  const boardUnknown = readBoard(state);
  const boardCells: Array<null | string> = [];
  for (let i = 0; i < 9; i++) {
    const c = boardUnknown[i];
    if (c !== null && c !== 'X' && c !== 'O') {
      return reject(InvalidBoardError({}));
    }
    boardCells.push(c);
  }
  return boardCells;
}

export function buildPlaceMarkEvents(
  boardCells: Array<null | string>,
  cell: number,
  player: 'X' | 'O',
  next_seq: number
): Event[] {
  const events: Event[] = [MarkPlaced({ cell, player, seq: next_seq })];
  const next_board = [...boardCells];
  next_board[cell] = player;
  const winner = checkWinner(next_board);

  if (winner === 'X' || winner === 'O') {
    events.push(GameWon({ winner, seq: next_seq + 1 }));
  } else if (isBoardFull(next_board)) {
    events.push(GameDrawn({ seq: next_seq + 1 }));
  }
  return events;
}

export function isTerminalEvent(event: Event): boolean {
  return (
    GameWon.is(event) ||
    GameDrawn.is(event) ||
    PlayerResigned.is(event) ||
    ForfeitWin.is(event) ||
    ClockTimeout.is(event)
  );
}

export function maybeBuildClockSwitchEvents(
  state: State,
  nextTurn: 'X' | 'O',
  nextSeq: number
): Event[] {
  const status = state['clockStatus'];
  if (status === 'idle') {
    return [
      ClockSliceSet({
        remainingMsX: TIC_TAC_TOE_CLOCK_MS_PER_PLAYER,
        remainingMsO: TIC_TAC_TOE_CLOCK_MS_PER_PLAYER,
        activePlayer: nextTurn,
        seq: nextSeq,
      }),
    ];
  }
  if (status === 'running') {
    const remainingMsX = state['remainingMsX'];
    const remainingMsO = state['remainingMsO'];
    if (
      !isFiniteNonNegative(remainingMsX) ||
      !isFiniteNonNegative(remainingMsO)
    ) {
      return [];
    }
    return [
      ClockSliceSet({
        remainingMsX,
        remainingMsO,
        activePlayer: nextTurn,
        seq: nextSeq,
      }),
    ];
  }
  return [];
}

export function canTickClockState(state: State): boolean {
  if (state['status'] === 'completed') return false;
  if (!seatsFullyClaimed(state)) return false;
  if (state['clockStatus'] !== 'running') return false;
  return true;
}

export function readClockTickInputs(
  state: State,
  elapsedMs: number
): {
  active: 'X' | 'O';
  remainingMsX: number;
  remainingMsO: number;
  nextSeq: number;
} | null {
  if (!canTickClockState(state)) return null;
  if (!isFiniteNonNegative(elapsedMs) || elapsedMs <= 0) return null;
  const active = state['clockActivePlayer'];
  if (active !== 'X' && active !== 'O') return null;
  const remainingMsX = state['remainingMsX'];
  const remainingMsO = state['remainingMsO'];
  if (
    !isFiniteNonNegative(remainingMsX) ||
    !isFiniteNonNegative(remainingMsO)
  ) {
    return null;
  }
  const seqRaw = state['seq'];
  if (!isFiniteNumber(seqRaw)) return null;
  return { active, remainingMsX, remainingMsO, nextSeq: seqRaw + 1 };
}

type TickClockInputs = NonNullable<ReturnType<typeof readClockTickInputs>>;

export function buildTickClockEvents(
  inputs: TickClockInputs,
  elapsedMs: number
): Event[] {
  const { active, remainingMsX, remainingMsO, nextSeq } = inputs;
  const nextX =
    active === 'X' ? Math.max(0, remainingMsX - elapsedMs) : remainingMsX;
  const nextO =
    active === 'O' ? Math.max(0, remainingMsO - elapsedMs) : remainingMsO;
  const activeRemaining = active === 'X' ? nextX : nextO;
  if (activeRemaining <= 0) {
    return [
      ClockTimeout({
        loser: active,
        winner: active === 'X' ? 'O' : 'X',
        atMs: nextSeq,
        seq: nextSeq,
      }),
    ];
  }
  return [
    ClockSliceSet({
      remainingMsX: nextX,
      remainingMsO: nextO,
      activePlayer: active,
      seq: nextSeq,
    }),
  ];
}
