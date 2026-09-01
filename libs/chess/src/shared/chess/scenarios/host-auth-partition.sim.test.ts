import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { ROOM_ERROR_TYPE } from '@pkgs/room';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from '../chess-puzzle-play';
import { chessSystem } from './chess-system';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';

describe('chess puzzle: host auth under partition (Gp-02)', () => {
  test('non-host submit rejected; domain still converges', async () => {
    await using host = await openWorld(chessSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = host.facade;
    const hostClient = await world.addClient({
      id: 'host',
      identity: 'host-1',
    });
    const spectator = await world.addClient({
      id: 'spec',
      identity: 'guest-1',
    });
    await world.assertConverged();

    hostClient.dispatch(
      StartChessPuzzlePlay({
        puzzleId: 'p1',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      })
    );
    await world.drain();
    expect(ChessPuzzlePlayAttr.status.from(await world.serverSnapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(ChessPuzzlePlayAttr.status.from(hostClient.snapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );

    {
      using _hold = world.net('spec').set('hold');
      spectator.dispatch(SubmitChessPuzzleMove({ uci: 'e1f2' }));
      await world.drain();
    }

    await world.assertConverged();
    expect(spectator.lastRejection()?.type).toBe(ROOM_ERROR_TYPE.unauthorized);
    expect(ChessPuzzlePlayAttr.status.from(await world.serverSnapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(ChessPuzzlePlayAttr.status.from(hostClient.snapshot())).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(hostClient.hash()).toBe(await world.serverHash());
    expect(hostClient.hash()).toBe(spectator.hash());
  });
});
