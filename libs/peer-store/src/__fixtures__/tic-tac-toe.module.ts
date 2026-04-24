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

function assertValidState(state: State): void {
  crash.field(state, 'board', 'state must have board');
  crash.array(state['board'], 'board must be an array');
  crash.ok(
    (state['board'] as unknown[]).length === 9,
    'board must have 9 cells'
  );
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

function err(code: string, message: string): HandleResult {
  return { ok: false, error: { code, message } };
}

function handlePlaceMark(state: State, command: Command): HandleResult {
  assertValidState(state);

  const payload = command.message.payload as Record<string, unknown>;
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

  const board = state['board'] as Array<null | string>;
  if (board[cell] !== null) {
    return err('CELL_OCCUPIED', `cell ${cell} is already occupied`);
  }

  const next_seq = (state['seq'] as number) + 1;
  const events: Event[] = [
    {
      type: 'MARK_PLACED',
      payload: { cell, player, seq: next_seq },
    },
  ];

  const next_board = [...board];
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

  const payload = command.message.payload as Record<string, unknown>;
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

  const next_seq = (state['seq'] as number) + 1;
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

export const TicTacToeModule: StoreModule = {
  initialState(): State {
    return {
      board: [null, null, null, null, null, null, null, null, null],
      currentTurn: 'X' as string,
      winner: null,
      status: 'in_progress' as string,
      seq: 0,
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

        const board = [...(state['board'] as Array<null | string>)];
        const cell = payload['cell'] as number;
        const player = payload['player'] as string;
        board[cell] = player;

        const next_turn = player === 'X' ? 'O' : 'X';
        const result: State = {
          ...state,
          board,
          currentTurn: next_turn,
          seq: payload['seq'] as number,
        };

        crash.ok(
          result['currentTurn'] === 'X' || result['currentTurn'] === 'O',
          'reduce postcondition: currentTurn must be X or O'
        );
        return result;
      }

      case 'GAME_WON': {
        const payload = event.payload as Record<string, unknown>;
        crash.record(payload, 'GAME_WON payload must be a record');
        crash.field(payload, 'winner', 'GAME_WON must have winner');
        crash.field(payload, 'seq', 'GAME_WON must have seq');

        return {
          ...state,
          winner: payload['winner'],
          status: 'completed',
          seq: payload['seq'] as number,
        };
      }

      case 'GAME_DRAWN': {
        const payload = event.payload as Record<string, unknown>;
        crash.field(payload, 'seq', 'GAME_DRAWN must have seq');

        return {
          ...state,
          winner: 'draw',
          status: 'completed',
          seq: payload['seq'] as number,
        };
      }

      case 'PLAYER_RESIGNED': {
        const payload = event.payload as Record<string, unknown>;
        crash.field(payload, 'player', 'PLAYER_RESIGNED must have player');
        crash.field(payload, 'seq', 'PLAYER_RESIGNED must have seq');

        const player = payload['player'] as string;
        const winner = player === 'X' ? 'O' : 'X';

        return {
          ...state,
          winner,
          status: 'completed',
          seq: payload['seq'] as number,
        };
      }

      default:
        return state;
    }
  },
};
