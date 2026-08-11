import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '@pkgs/room/tests';

import { ChessModule } from '../chess-module';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from '../chess-puzzle-play';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
/** One opponent token → start lands in solved. */
const SHORT_MOVES = 'e8d7';

describe('chess puzzle: solved monotonic (Gp-03)', () => {
  test('post-solved moves do not change terminal status', async () => {
    await using world = await openRoomSimWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: ChessModule,
    });
    const host = await world.addClient({ id: 'host', identity: 'host-1' });
    await world.assertConverged();

    host.dispatch(
      StartChessPuzzlePlay({
        puzzleId: 'short',
        fen: VALID_FEN,
        moves: SHORT_MOVES,
      })
    );
    await world.drain();
    expect(ChessPuzzlePlayAttr.status.from(await world.serverSnapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    expect(ChessPuzzlePlayAttr.status.from(host.snapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    const terminalHash = await world.serverHash();
    expect(host.hash()).toBe(terminalHash);

    host.dispatch(SubmitChessPuzzleMove({ uci: 'e1f2' }));
    host.dispatch(SubmitChessPuzzleMove({ uci: 'a2a3' }));
    await world.drain();

    expect(ChessPuzzlePlayAttr.status.from(await world.serverSnapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    expect(ChessPuzzlePlayAttr.status.from(host.snapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    expect(host.hash()).toBe(await world.serverHash());
    expect(await world.serverHash()).toBe(terminalHash);
  });
});
