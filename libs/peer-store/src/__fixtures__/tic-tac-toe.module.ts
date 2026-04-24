import { Assert } from '@gamezilla/lib/assert';
import type {
  Command,
  Event,
  HandleResult,
  State,
  StoreModule,
} from '../types';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

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

function readBoard(state: State): unknown[] {
  crash.field(state, 'board', 'state must have board');
  crash.array(state['board'], 'board must be an array');
  const b = state['board'];
  crash.ok(b.length === 9, 'board must have 9 cells');
  return b;
}

function readSeat(
  state: State,
  key: 'seatX' | 'seatO',
  label: string,
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

function seatsFullyClaimed(state: State): boolean {
  const x = readSeat(state, 'seatX', 'seatX');
  const o = readSeat(state, 'seatO', 'seatO');
  return x !== null && o !== null;
}

function assertValidState(state: State): void {
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
}

function assertPeerOwnsMark(
  state: State,
  command: Command,
  player: 'X' | 'O',
): HandleResult | null {
  if (!seatsFullyClaimed(state)) {
    return null;
  }
  const seatKey = player === 'X' ? 'seatX' : 'seatO';
  const expected = readSeat(state, seatKey, seatKey);
  if (expected !== command.peerId) {
    return err(
      'NOT_YOUR_MARK',
      `peer ${command.peerId} cannot act as ${player}`,
    );
  }
  return null;
}

function err(code: string, message: string): HandleResult {
  return { ok: false, error: { code, message } };
}

function handlePlaceMark(state: State, command: Command): HandleResult {
  assertValidState(state);

  const rawPayload = command.message.payload;
  if (
    rawPayload === null ||
    typeof rawPayload !== 'object' ||
    Array.isArray(rawPayload)
  ) {
    return err('INVALID_PAYLOAD', 'PLACE_MARK payload must be a plain object');
  }
  const payload = rawPayload;
  validation.field(payload, 'cell', 'PLACE_MARK payload must have cell');
  validation.field(payload, 'player', 'PLACE_MARK payload must have player');

  const cell = payload['cell'];
  const player = payload['player'];

  if (
    typeof cell !== 'number' ||
    cell < 0 ||
    cell > 8 ||
    !Number.isInteger(cell)
  ) {
    return err(
      'INVALID_CELL',
      `cell must be integer 0-8, got: ${String(cell)}`
    );
  }
  if (player !== 'X' && player !== 'O') {
    return err(
      'INVALID_PLAYER',
      `player must be X or O, got: ${String(player)}`
    );
  }
  if (state['status'] === 'completed') {
    return err('GAME_OVER', 'game is already completed');
  }
  if (state['currentTurn'] !== player) {
    return err('WRONG_TURN', `not ${String(player)}'s turn`);
  }

  const seatErr = assertPeerOwnsMark(state, command, player);
  if (seatErr !== null) {
    return seatErr;
  }

  const boardUnknown = readBoard(state);
  const boardCells: Array<null | string> = [];
  for (let i = 0; i < 9; i++) {
    const c = boardUnknown[i];
    if (c !== null && c !== 'X' && c !== 'O') {
      return err('INVALID_BOARD', 'board cell must be null, X, or O');
    }
    boardCells.push(c);
  }
  if (boardCells[cell] !== null) {
    return err('CELL_OCCUPIED', `cell ${cell} is already occupied`);
  }

  const seqRaw = state['seq'];
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return err('INVALID_STATE', 'state.seq must be a finite number');
  }
  const next_seq = seqRaw + 1;
  const events: Event[] = [
    {
      type: 'MARK_PLACED',
      payload: { cell, player, seq: next_seq },
    },
  ];

  const next_board = [...boardCells];
  next_board[cell] = player;
  const winner = checkWinner(next_board);

  if (winner) {
    events.push({
      type: 'GAME_WON',
      payload: { winner, seq: next_seq + 1 },
    });
  } else if (isBoardFull(next_board)) {
    events.push({
      type: 'GAME_DRAWN',
      payload: { seq: next_seq + 1 },
    });
  }

  return { ok: true, value: { events } };
}

function handleResign(state: State, command: Command): HandleResult {
  assertValidState(state);

  const rawPayload = command.message.payload;
  if (
    rawPayload === null ||
    typeof rawPayload !== 'object' ||
    Array.isArray(rawPayload)
  ) {
    return err('INVALID_PAYLOAD', 'RESIGN payload must be a plain object');
  }
  const payload = rawPayload;
  validation.field(payload, 'player', 'RESIGN payload must have player');

  const player = payload['player'];

  if (player !== 'X' && player !== 'O') {
    return err(
      'INVALID_PLAYER',
      `player must be X or O, got: ${String(player)}`
    );
  }
  if (state['status'] === 'completed') {
    return err('GAME_OVER', 'game is already completed');
  }

  const seatErr = assertPeerOwnsMark(state, command, player);
  if (seatErr !== null) {
    return seatErr;
  }

  const seqRaw = state['seq'];
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return err('INVALID_STATE', 'state.seq must be a finite number');
  }
  const next_seq = seqRaw + 1;
  return {
    ok: true,
    value: {
      events: [
        {
          type: 'PLAYER_RESIGNED',
          payload: { player, seq: next_seq },
        },
      ],
    },
  };
}

function handleJoinSession(state: State, command: Command): HandleResult {
  assertValidState(state);

  const rawPayload = command.message.payload;
  if (
    rawPayload === null ||
    typeof rawPayload !== 'object' ||
    Array.isArray(rawPayload)
  ) {
    return err(
      'INVALID_PAYLOAD',
      'JOIN_SESSION payload must be a plain object',
    );
  }
  const payload = rawPayload;
  validation.field(payload, 'mark', 'JOIN_SESSION payload must have mark');

  const markRaw = payload['mark'];
  if (markRaw !== 'X' && markRaw !== 'O') {
    return err(
      'INVALID_MARK',
      `mark must be X or O, got: ${String(markRaw)}`,
    );
  }
  const mark = markRaw;

  if (state['status'] === 'completed') {
    return err('GAME_OVER', 'cannot join a completed game');
  }

  const seatX = readSeat(state, 'seatX', 'seatX');
  const seatO = readSeat(state, 'seatO', 'seatO');
  const peerId = command.peerId;

  const otherSeat = mark === 'X' ? seatO : seatX;
  if (otherSeat === peerId) {
    return err('ALREADY_SEATED', 'peer already holds the other mark');
  }

  const mySeat = mark === 'X' ? seatX : seatO;
  if (mySeat !== null && mySeat !== peerId) {
    return err('SEAT_TAKEN', `mark ${mark} is already claimed`);
  }

  const seqRaw = state['seq'];
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return err('INVALID_STATE', 'state.seq must be a finite number');
  }
  const next_seq = seqRaw + 1;

  return {
    ok: true,
    value: {
      events: [
        {
          type: 'SEAT_CLAIMED',
          payload: { mark, peerId, seq: next_seq },
        },
      ],
    },
  };
}

function handleLeaveSession(state: State, command: Command): HandleResult {
  assertValidState(state);

  const rawPayload = command.message.payload;
  if (
    rawPayload === null ||
    typeof rawPayload !== 'object' ||
    Array.isArray(rawPayload)
  ) {
    return err(
      'INVALID_PAYLOAD',
      'LEAVE_SESSION payload must be a plain object',
    );
  }

  const seatX = readSeat(state, 'seatX', 'seatX');
  const seatO = readSeat(state, 'seatO', 'seatO');
  const peerId = command.peerId;

  const held: Array<'X' | 'O'> = [];
  if (seatX === peerId) {
    held.push('X');
  }
  if (seatO === peerId) {
    held.push('O');
  }
  if (held.length === 0) {
    return err('NOT_SEATED', 'peer has no seat to leave');
  }

  const seqRaw = state['seq'];
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return err('INVALID_STATE', 'state.seq must be a finite number');
  }

  const events: Event[] = [];
  let seq = seqRaw + 1;
  for (const mark of held) {
    events.push({
      type: 'SEAT_RELEASED',
      payload: { mark, peerId, seq },
    });
    seq += 1;
  }

  const nextSeatX = held.includes('X') ? null : seatX;
  const nextSeatO = held.includes('O') ? null : seatO;

  const inProgress = state['status'] === 'in_progress';
  const oneRemains =
    (nextSeatX !== null && nextSeatO === null) ||
    (nextSeatX === null && nextSeatO !== null);
  if (inProgress && oneRemains && seatsFullyClaimed(state)) {
    const winner: 'X' | 'O' =
      nextSeatX !== null && nextSeatO === null ? 'X' : 'O';
    events.push({
      type: 'FORFEIT_WIN',
      payload: { winner, seq },
    });
    seq += 1;
  }

  return { ok: true, value: { events } };
}

export const TicTacToeModule: StoreModule = {
  initialState(): State {
    return {
      board: [null, null, null, null, null, null, null, null, null],
      currentTurn: 'X',
      winner: null,
      status: 'in_progress',
      seq: 0,
      seatX: null,
      seatO: null,
    };
  },

  handle(state: State, command: Command): HandleResult {
    crash.defined(state, 'state must be defined');
    crash.defined(command, 'command must be defined');
    crash.nonEmptyString(
      command.message.type,
      'command message type must be non-empty'
    );

    switch (command.message.type) {
      case 'PLACE_MARK':
        return handlePlaceMark(state, command);
      case 'RESIGN':
        return handleResign(state, command);
      case 'JOIN_SESSION':
        return handleJoinSession(state, command);
      case 'LEAVE_SESSION':
        return handleLeaveSession(state, command);
      default:
        return err(
          'UNKNOWN_COMMAND',
          `unknown command type: ${command.message.type}`
        );
    }
  },

  reduce(state: State, event: Event): State {
    crash.defined(state, 'state must be defined');
    crash.defined(event, 'event must be defined');

    switch (event.type) {
      case 'MARK_PLACED': {
        const payload = event.payload;
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
            'board cell must be null, X, or O',
          );
          board.push(c);
        }
        const cell = payload['cell'];
        const player = payload['player'];
        crash.number(cell, 'MARK_PLACED cell must be a finite number');
        crash.ok(
          Number.isInteger(cell) && cell >= 0 && cell <= 8,
          'MARK_PLACED cell must be integer 0..8',
        );
        crash.string(player, 'MARK_PLACED player must be string');
        crash.ok(player === 'X' || player === 'O', 'MARK_PLACED player must be X or O');
        board[cell] = player;

        const next_turn = player === 'X' ? 'O' : 'X';
        const seqVal = payload['seq'];
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

      case 'GAME_WON': {
        const payload = event.payload;
        crash.record(payload, 'GAME_WON payload must be a record');
        crash.field(payload, 'winner', 'GAME_WON must have winner');
        crash.field(payload, 'seq', 'GAME_WON must have seq');
        const seqVal = payload['seq'];
        crash.number(seqVal, 'GAME_WON seq must be a finite number');

        return {
          ...state,
          winner: payload['winner'],
          status: 'completed',
          seq: seqVal,
        };
      }

      case 'GAME_DRAWN': {
        const payload = event.payload;
        crash.record(payload, 'GAME_DRAWN payload must be a record');
        crash.field(payload, 'seq', 'GAME_DRAWN must have seq');
        const seqVal = payload['seq'];
        crash.number(seqVal, 'GAME_DRAWN seq must be a finite number');

        return {
          ...state,
          winner: 'draw',
          status: 'completed',
          seq: seqVal,
        };
      }

      case 'PLAYER_RESIGNED': {
        const payload = event.payload;
        crash.record(payload, 'PLAYER_RESIGNED payload must be a record');
        crash.field(payload, 'player', 'PLAYER_RESIGNED must have player');
        crash.field(payload, 'seq', 'PLAYER_RESIGNED must have seq');

        const player = payload['player'];
        crash.string(player, 'PLAYER_RESIGNED player must be string');
        crash.ok(player === 'X' || player === 'O', 'PLAYER_RESIGNED player must be X or O');
        const winner = player === 'X' ? 'O' : 'X';
        const seqVal = payload['seq'];
        crash.number(seqVal, 'PLAYER_RESIGNED seq must be a finite number');

        return {
          ...state,
          winner,
          status: 'completed',
          seq: seqVal,
        };
      }

      case 'SEAT_CLAIMED': {
        const payload = event.payload;
        crash.record(payload, 'SEAT_CLAIMED payload must be a record');
        crash.field(payload, 'mark', 'SEAT_CLAIMED must have mark');
        crash.field(payload, 'peerId', 'SEAT_CLAIMED must have peerId');
        crash.field(payload, 'seq', 'SEAT_CLAIMED must have seq');
        const markRaw = payload['mark'];
        crash.ok(markRaw === 'X' || markRaw === 'O', 'SEAT_CLAIMED mark must be X or O');
        const mark = markRaw;
        crash.string(payload['peerId'], 'SEAT_CLAIMED peerId must be string');
        const seqVal = payload['seq'];
        crash.number(seqVal, 'SEAT_CLAIMED seq must be a finite number');
        const seatKey = mark === 'X' ? 'seatX' : 'seatO';
        return {
          ...state,
          [seatKey]: payload['peerId'],
          seq: seqVal,
        };
      }

      case 'SEAT_RELEASED': {
        const payload = event.payload;
        crash.record(payload, 'SEAT_RELEASED payload must be a record');
        crash.field(payload, 'mark', 'SEAT_RELEASED must have mark');
        crash.field(payload, 'peerId', 'SEAT_RELEASED must have peerId');
        crash.field(payload, 'seq', 'SEAT_RELEASED must have seq');
        const markRaw = payload['mark'];
        crash.ok(markRaw === 'X' || markRaw === 'O', 'SEAT_RELEASED mark must be X or O');
        const mark = markRaw;
        crash.string(payload['peerId'], 'SEAT_RELEASED peerId must be string');
        const seqVal = payload['seq'];
        crash.number(seqVal, 'SEAT_RELEASED seq must be a finite number');
        const seatKey = mark === 'X' ? 'seatX' : 'seatO';
        const prev = readSeat(state, seatKey, seatKey);
        const cleared =
          prev === payload['peerId'] ? null : prev;
        return {
          ...state,
          [seatKey]: cleared,
          seq: seqVal,
        };
      }

      case 'FORFEIT_WIN': {
        const payload = event.payload;
        crash.record(payload, 'FORFEIT_WIN payload must be a record');
        crash.field(payload, 'winner', 'FORFEIT_WIN must have winner');
        crash.field(payload, 'seq', 'FORFEIT_WIN must have seq');
        const w = payload['winner'];
        crash.string(w, 'FORFEIT_WIN winner must be string');
        crash.ok(w === 'X' || w === 'O', 'FORFEIT_WIN winner must be X or O');
        const seqVal = payload['seq'];
        crash.number(seqVal, 'FORFEIT_WIN seq must be a finite number');
        return {
          ...state,
          winner: w,
          status: 'completed',
          seq: seqVal,
        };
      }

      default:
        return state;
    }
  },
};
