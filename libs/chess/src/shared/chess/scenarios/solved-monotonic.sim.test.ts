import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientState,
  dispatch,
  expectConverged,
  passTime,
  serverHash,
  serverState,
  startRoom,
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
    await using run = await startRoom(chessSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
    });
    await run.apply(addClient, { id: 'host', identity: 'host-1' });
    await expectConverged(run);

    await run.apply(dispatch, {
      clientId: 'host',
      payload: StartChessPuzzlePlay({
        puzzleId: 'short',
        fen: VALID_FEN,
        moves: SHORT_MOVES,
      }),
    });
    await run.apply(passTime, 0);
    expect(
      ChessPuzzlePlayAttr.status.from((await run.observe(serverState)) as never)
    ).toBe(CHESS_PUZZLE_PLAY_STATUS.solved);
    const clients = await run.observe(clientState);
    expect(ChessPuzzlePlayAttr.status.from(clients['host'] as never)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    const terminalHash = await run.observe(serverHash);

    await run.apply(dispatch, {
      clientId: 'host',
      payload: SubmitChessPuzzleMove({ uci: 'e1f2' }),
    });
    await run.apply(dispatch, {
      clientId: 'host',
      payload: SubmitChessPuzzleMove({ uci: 'a2a3' }),
    });
    await run.apply(passTime, 0);

    expect(
      ChessPuzzlePlayAttr.status.from((await run.observe(serverState)) as never)
    ).toBe(CHESS_PUZZLE_PLAY_STATUS.solved);
    expect(await run.observe(serverHash)).toBe(terminalHash);
  });
});
