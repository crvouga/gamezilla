import { describe, test } from 'bun:test';
import type { RoomState } from '@pkgs/room';
import { type GenCtx, runModuleConformance } from '@pkgs/room/tests';

import { ChessModule } from './chess-module';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  ClearChessPuzzlePlay,
  StartChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from './chess-puzzle-play';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';

const VALID_STATUSES = new Set<string>(Object.values(CHESS_PUZZLE_PLAY_STATUS));

function isValidPuzzleState(s: RoomState): boolean {
  return VALID_STATUSES.has(ChessPuzzlePlayAttr.status.from(s));
}

function isTerminalPuzzle(s: RoomState): boolean {
  const st = ChessPuzzlePlayAttr.status.from(s);
  return (
    st === CHESS_PUZZLE_PLAY_STATUS.solved ||
    st === CHESS_PUZZLE_PLAY_STATUS.invalid
  );
}

function puzzleOutcomeId(s: RoomState): string | null {
  return isTerminalPuzzle(s) ? ChessPuzzlePlayAttr.status.from(s) : null;
}

function generatePuzzleCommand(ctx: GenCtx<RoomState>) {
  const st = ChessPuzzlePlayAttr.status.from(ctx.state);
  if (st === CHESS_PUZZLE_PLAY_STATUS.idle) {
    return StartChessPuzzlePlay({
      puzzleId: 'p1',
      fen: VALID_FEN,
      moves: VALID_MOVES,
    });
  }
  const host = ChessPuzzlePlayAttr.hostIdentity.from(ctx.state);
  if (ctx.identity !== host) return null;
  if (
    st === CHESS_PUZZLE_PLAY_STATUS.solving ||
    st === CHESS_PUZZLE_PLAY_STATUS.wrong
  ) {
    if (ctx.rng.bool(0.2)) return ClearChessPuzzlePlay({});
    return SubmitChessPuzzleMove({
      uci: ctx.rng.bool(0.7) ? 'e1f2' : 'a2a3',
    });
  }
  if (isTerminalPuzzle(ctx.state)) {
    return ctx.rng.bool(0.5) ? ClearChessPuzzlePlay({}) : null;
  }
  return null;
}

describe('chess puzzle conformance (Gp-01)', () => {
  test('ChessModule passes module-contract kit', async () => {
    await runModuleConformance({
      seed: process.env['SIM_SEED'] ?? '42',
      module: ChessModule,
      identities: ['host-1', 'guest-1'],
      mildFaults: false,
      fuzzSteps: 16,
      isValidState: isValidPuzzleState,
      isTerminal: isTerminalPuzzle,
      outcomeId: puzzleOutcomeId,
      generateCommand: generatePuzzleCommand,
    });
  });
});
