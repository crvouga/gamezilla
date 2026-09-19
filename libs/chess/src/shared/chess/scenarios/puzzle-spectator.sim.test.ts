import { describe, expect, test } from 'bun:test';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import {
  addClient,
  dispatch,
  expectInSync,
  readClient,
  readRejection,
  readServer,
} from '@pkgs/room-sim';
import type { ChessPuzzleRecommendationMap } from '../../puzzle-session/recommendations';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  RecommendChessPuzzleMove,
  SkipChessPuzzlePlay,
  StartChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from '../chess-puzzle-play';
import { chessSystem } from './chess-system';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';

describe('chess room sim: host drives, guest spectates', () => {
  test('a guest cannot drive and both clients converge on host truth', async () => {
    await using s = await chessSystem.run({ seed: 7 });
    await s.apply(addClient, { id: 'host' });
    await s.apply(addClient, { id: 'guest' });
    await expectInSync(s);

    await s.apply(dispatch, {
      clientId: 'host',
      payload: StartChessPuzzlePlay({
        puzzleId: 'puzzle-sim-1',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      }),
    });
    await expectInSync(s);

    await s.apply(dispatch, {
      clientId: 'guest',
      payload: SubmitChessPuzzleMove({ uci: 'e1f2' }),
    });
    expect((await readRejection(s, 'guest'))?.type).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );
    await s.apply(dispatch, {
      clientId: 'guest',
      payload: SkipChessPuzzlePlay({}),
    });
    expect((await readRejection(s, 'guest'))?.type).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );
    const server = await readServer(s);
    expect(ChessPuzzlePlayAttr.status.from(server)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );

    await s.apply(dispatch, {
      clientId: 'guest',
      payload: RecommendChessPuzzleMove({ from: 'e1', to: 'f2' }),
    });
    await expectInSync(s);
    const expected: ChessPuzzleRecommendationMap = {
      guest: { from: 'e1', to: 'f2', seq: 1 },
    };
    expect(
      ChessPuzzlePlayAttr.recommendations.from(await readClient(s, 'host'))
    ).toEqual(expected);
    expect(
      ChessPuzzlePlayAttr.recommendations.from(await readClient(s, 'guest'))
    ).toEqual(expected);

    await s.apply(dispatch, {
      clientId: 'host',
      payload: SubmitChessPuzzleMove({ uci: 'e1f2' }),
    });
    await expectInSync(s);
    const afterMove = await readClient(s, 'guest');
    expect(ChessPuzzlePlayAttr.recommendations.from(afterMove)).toEqual({});
    expect(ChessPuzzlePlayAttr.displayFen.from(afterMove)).toBe(
      ChessPuzzlePlayAttr.displayFen.from(await readServer(s))
    );
  });
});
