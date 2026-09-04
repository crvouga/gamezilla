import { describe, expect, test } from 'bun:test';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import {
  addClient,
  clientHash,
  clientState,
  dispatch,
  expectConverged,
  hold,
  lastRejection,
  release,
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

describe('chess puzzle: host auth under partition (Gp-02)', () => {
  test('non-host submit rejected; domain still converges', async () => {
    await using s = await chessSystem.script({
      seed: process.env['SIM_SEED'] ?? '42',
    });
    await s.apply(addClient, { id: 'host', identity: 'host-1' });
    await s.apply(addClient, { id: 'spec', identity: 'guest-1' });
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'host',
      payload: StartChessPuzzlePlay({
        puzzleId: 'p1',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      }),
    });
    await s.elapse(0);
    expect(
      ChessPuzzlePlayAttr.status.from((await s.observe(serverState)) as never)
    ).toBe(CHESS_PUZZLE_PLAY_STATUS.solving);

    await s.apply(hold, 'spec');
    await s.apply(dispatch, {
      clientId: 'spec',
      payload: SubmitChessPuzzleMove({ uci: 'e1f2' }),
    });
    await s.apply(release, 'spec');

    await expectConverged(s);
    const rejections = (await s.observe(lastRejection)) as Record<
      string,
      { readonly type?: string } | null
    >;
    expect(rejections['spec']?.type).toBe(ROOM_ERROR_TYPE.unauthorized);
    expect(
      ChessPuzzlePlayAttr.status.from((await s.observe(serverState)) as never)
    ).toBe(CHESS_PUZZLE_PLAY_STATUS.solving);
    const clients = await s.observe(clientState);
    expect(ChessPuzzlePlayAttr.status.from(clients['host'] as never)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    const hashes = (await s.observe(clientHash)) as Record<string, string>;
    expect(hashes['host']).toBe(await s.observe(serverHash));
    expect(hashes['host']).toBe(hashes['spec']);
  });
});
