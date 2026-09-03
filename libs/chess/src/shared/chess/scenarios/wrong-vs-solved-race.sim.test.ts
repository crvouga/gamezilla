import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
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
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';

describe('chess puzzle: wrong vs solve race (Gp-04)', () => {
  test('two host tabs race moves → one consistent status', async () => {
    await using run = await startRoom(chessSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      mildFaults: true,
    });
    await run.apply(addClient, {
      id: 'tab1',
      identity: 'host-1',
      clientId: 'tab-1',
    });
    await run.apply(addClient, {
      id: 'tab2',
      identity: 'host-1',
      clientId: 'tab-2',
    });
    await expectConverged(run);

    await run.apply(dispatch, {
      clientId: 'tab1',
      payload: StartChessPuzzlePlay({
        puzzleId: 'race',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      }),
    });
    await run.apply(passTime, 0);

    await run.apply(dispatch, {
      clientId: 'tab1',
      payload: SubmitChessPuzzleMove({ uci: 'e1f2' }),
    });
    await run.apply(dispatch, {
      clientId: 'tab2',
      payload: SubmitChessPuzzleMove({ uci: 'a2a3' }),
    });
    await expectConverged(run);

    const serverStatus = ChessPuzzlePlayAttr.status.from(
      (await run.observe(serverState)) as never
    );
    expect(
      serverStatus === CHESS_PUZZLE_PLAY_STATUS.solving ||
        serverStatus === CHESS_PUZZLE_PLAY_STATUS.wrong ||
        serverStatus === CHESS_PUZZLE_PLAY_STATUS.solved
    ).toBe(true);
    const clients = await run.observe(clientState);
    expect(ChessPuzzlePlayAttr.status.from(clients['tab1'] as never)).toBe(
      serverStatus
    );
    const hashes = (await run.observe(clientHash)) as Record<string, string>;
    expect(hashes['tab1']).toBe(await run.observe(serverHash));
    expect(hashes['tab1']).toBe(hashes['tab2']);
  });
});
