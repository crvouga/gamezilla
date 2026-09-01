import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '@pkgs/room/tests';

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
    await using host = await openWorld(chessSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0, mildFaults: true },
    });
    const world = roomWorld(host.state);
    const tab1 = await world.addClient({
      id: 'tab1',
      identity: 'host-1',
      clientId: 'tab-1',
    });
    const tab2 = await world.addClient({
      id: 'tab2',
      identity: 'host-1',
      clientId: 'tab-2',
    });
    await world.assertConverged();

    tab1.dispatch(
      StartChessPuzzlePlay({
        puzzleId: 'race',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      })
    );
    await world.drain();

    tab1.dispatch(SubmitChessPuzzleMove({ uci: 'e1f2' }));
    tab2.dispatch(SubmitChessPuzzleMove({ uci: 'a2a3' }));
    await world.assertConverged();

    const serverStatus = ChessPuzzlePlayAttr.status.from(
      await world.serverSnapshot()
    );
    expect(
      serverStatus === CHESS_PUZZLE_PLAY_STATUS.solving ||
        serverStatus === CHESS_PUZZLE_PLAY_STATUS.wrong ||
        serverStatus === CHESS_PUZZLE_PLAY_STATUS.solved
    ).toBe(true);
    const status = ChessPuzzlePlayAttr.status.from(tab1.snapshot());
    expect(status).toBe(serverStatus);
    expect(tab1.hash()).toBe(await world.serverHash());
    expect(tab1.hash()).toBe(tab2.hash());
  });
});
