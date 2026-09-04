import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientState,
  dispatch,
  expectConverged,
  serverHash,
  serverState,
} from '@pkgs/room/tests';

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
    await using s = await chessSystem.script({
      seed: process.env['SIM_SEED'] ?? '42',
    });
    await s.apply(addClient, { id: 'host', identity: 'host-1' });
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'host',
      payload: StartChessPuzzlePlay({
        puzzleId: 'short',
        fen: VALID_FEN,
        moves: SHORT_MOVES,
      }),
    });
    await s.elapse(0);
    expect(
      ChessPuzzlePlayAttr.status.from((await s.observe(serverState)) as never)
    ).toBe(CHESS_PUZZLE_PLAY_STATUS.solved);
    const clients = await s.observe(clientState);
    expect(ChessPuzzlePlayAttr.status.from(clients['host'] as never)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    const terminalHash = await s.observe(serverHash);

    await s.apply(dispatch, {
      clientId: 'host',
      payload: SubmitChessPuzzleMove({ uci: 'e1f2' }),
    });
    await s.apply(dispatch, {
      clientId: 'host',
      payload: SubmitChessPuzzleMove({ uci: 'a2a3' }),
    });
    await s.elapse(0);

    expect(
      ChessPuzzlePlayAttr.status.from((await s.observe(serverState)) as never)
    ).toBe(CHESS_PUZZLE_PLAY_STATUS.solved);
    expect(await s.observe(serverHash)).toBe(terminalHash);
  });
});
