import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
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
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';

describe('chess puzzle: wrong vs solve race (Gp-04)', () => {
  test('two host tabs race moves → one consistent status', async () => {
    await using s = await chessSystem.script({
      seed: process.env['SIM_SEED'] ?? '42',
      args: { mildFaults: true },
    });
    await s.apply(addClient, {
      id: 'tab1',
      identity: 'host-1',
      clientId: 'tab-1',
    });
    await s.apply(addClient, {
      id: 'tab2',
      identity: 'host-1',
      clientId: 'tab-2',
    });
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'tab1',
      payload: StartChessPuzzlePlay({
        puzzleId: 'race',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      }),
    });
    await s.elapse(0);

    await s.apply(dispatch, {
      clientId: 'tab1',
      payload: SubmitChessPuzzleMove({ uci: 'e1f2' }),
    });
    await s.apply(dispatch, {
      clientId: 'tab2',
      payload: SubmitChessPuzzleMove({ uci: 'a2a3' }),
    });
    await expectConverged(s);

    const serverStatus = ChessPuzzlePlayAttr.status.from(
      (await s.observe(serverState)) as never
    );
    expect(
      serverStatus === CHESS_PUZZLE_PLAY_STATUS.solving ||
        serverStatus === CHESS_PUZZLE_PLAY_STATUS.wrong ||
        serverStatus === CHESS_PUZZLE_PLAY_STATUS.solved
    ).toBe(true);
    const clients = await s.observe(clientState);
    expect(ChessPuzzlePlayAttr.status.from(clients['tab1'] as never)).toBe(
      serverStatus
    );
    const hashes = (await s.observe(clientHash)) as Record<string, string>;
    expect(hashes['tab1']).toBe(await s.observe(serverHash));
    expect(hashes['tab1']).toBe(hashes['tab2']);
  });
});
