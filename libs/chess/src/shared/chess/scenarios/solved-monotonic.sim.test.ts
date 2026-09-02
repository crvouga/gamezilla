import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from '../chess-puzzle-play';
import { chessSystem } from './chess-system';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
/** One opponent token → start lands in solved. */
const SHORT_MOVES = 'e8d7';

describe('chess puzzle: solved monotonic (Gp-03)', () => {
  test('post-solved moves do not change terminal status', async () => {
    await using world = await openWorld(chessSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const hostClient = await world.addClient({
      id: 'host',
      identity: 'host-1',
    });
    await world.assertConverged();

    hostClient.dispatch(
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
    expect(ChessPuzzlePlayAttr.status.from(hostClient.snapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    const terminalHash = await world.serverHash();
    expect(hostClient.hash()).toBe(terminalHash);

    hostClient.dispatch(SubmitChessPuzzleMove({ uci: 'e1f2' }));
    hostClient.dispatch(SubmitChessPuzzleMove({ uci: 'a2a3' }));
    await world.drain();

    expect(ChessPuzzlePlayAttr.status.from(await world.serverSnapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    expect(ChessPuzzlePlayAttr.status.from(hostClient.snapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    expect(hostClient.hash()).toBe(await world.serverHash());
    expect(await world.serverHash()).toBe(terminalHash);
  });
});
