import { describe, expect, test } from 'bun:test';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import {
  addClient,
  clientHash,
  clientState,
  converge,
  dispatch,
  hold,
  lastRejection,
  passTime,
  release,
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

describe('chess puzzle: host auth under partition (Gp-02)', () => {
  test('non-host submit rejected; domain still converges', async () => {
    await using run = await startRoom(chessSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
    });
    await run.apply(addClient, { id: 'host', identity: 'host-1' });
    await run.apply(addClient, { id: 'spec', identity: 'guest-1' });
    await run.apply(converge);

    await run.apply(dispatch, {
      clientId: 'host',
      payload: StartChessPuzzlePlay({
        puzzleId: 'p1',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      }),
    });
    await run.apply(passTime, 0);
    expect(
      ChessPuzzlePlayAttr.status.from((await run.observe(serverState)) as never)
    ).toBe(CHESS_PUZZLE_PLAY_STATUS.solving);

    await run.apply(hold, 'spec');
    await run.apply(dispatch, {
      clientId: 'spec',
      payload: SubmitChessPuzzleMove({ uci: 'e1f2' }),
    });
    await run.apply(release, 'spec');

    await run.apply(converge);
    const rejections = (await run.observe(lastRejection)) as Record<
      string,
      { readonly type?: string } | null
    >;
    expect(rejections['spec']?.type).toBe(ROOM_ERROR_TYPE.unauthorized);
    expect(
      ChessPuzzlePlayAttr.status.from((await run.observe(serverState)) as never)
    ).toBe(CHESS_PUZZLE_PLAY_STATUS.solving);
    const clients = await run.observe(clientState);
    expect(ChessPuzzlePlayAttr.status.from(clients['host'] as never)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    const hashes = (await run.observe(clientHash)) as Record<string, string>;
    expect(hashes['host']).toBe(await run.observe(serverHash));
    expect(hashes['host']).toBe(hashes['spec']);
  });
});
