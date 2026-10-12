import { describe, expect, test } from 'bun:test';
import { gameRecord } from '@libs/chess-matchmaking-shared/game-record';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { Chess } from 'chess.js';

const NAMES = { white: 'alice', black: 'bob' } as const;

/** A stored game after these moves, ended as named. */
function stored(
  moves: readonly string[],
  patch: Partial<MultiplayerGame> = {}
): MultiplayerGame {
  const board = new Chess();
  for (const move of moves) board.move(move);
  return {
    id: 'game-1',
    white_id: 'white-user',
    black_id: 'black-user',
    fen: board.fen(),
    pgn: board.pgn(),
    revision: moves.length,
    turn: '',
    outcome: 'white',
    reason: 'resignation',
    time_control: '5+0',
    white_ms: 300_000,
    black_ms: 300_000,
    clock_at_ms: 0,
    draw_offer_by: null,
    rematch_offer_by: null,
    rematch_of: null,
    white_rating: '1500?',
    black_rating: '1482',
    white_rating_diff: null,
    black_rating_diff: null,
    ...patch,
  };
}

/** The record as another chess program reads it. */
function opened(record: string | null) {
  const board = new Chess();
  board.loadPgn(record ?? '', { strict: true });
  return { moves: board.history(), tags: board.getHeaders() };
}

describe('the game record of a finished multiplayer game', () => {
  test.each([
    ['white', '1-0'],
    ['black', '0-1'],
    ['draw', '1/2-1/2'],
  ] as const)(
    'a game that ended as %s reads back with the result %s',
    (outcome, result) => {
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'];
      const record = gameRecord(stored(moves, { outcome }), NAMES);
      const read = opened(record);
      expect(read.moves).toEqual(moves);
      expect(read.tags['Result']).toBe(result);
      expect(record?.trimEnd().endsWith(` ${result}`)).toBe(true);
    }
  );

  test('it names both people, the time control and their ratings', () => {
    const { tags } = opened(gameRecord(stored(['e4', 'e5']), NAMES));
    expect(tags).toMatchObject({
      Event: 'Multiplayer chess',
      White: 'alice',
      Black: 'bob',
      Result: '1-0',
      TimeControl: '300+0',
      WhiteElo: '1500',
      BlackElo: '1482',
      Termination: 'normal',
    });
  });

  test.each([
    ['2+1', '120+1'],
    ['30+20', '1800+20'],
    ['1d', '1/86400'],
    ['3d', '1/259200'],
    [null, '?'],
  ])('the time control %s is written %s', (timeControl, written) => {
    const game = stored(['e4', 'e5'], { time_control: timeControl });
    expect(opened(gameRecord(game, NAMES)).tags['TimeControl']).toBe(written);
  });

  test('a game lost on time says so', () => {
    const game = stored(['e4', 'e5'], { outcome: 'black', reason: 'timeout' });
    expect(opened(gameRecord(game, NAMES)).tags['Termination']).toBe(
      'time forfeit'
    );
  });

  test('a name is written so the record still opens', () => {
    const names = { white: 'Deleted account', black: 'say "hi" \\ bye' };
    const read = opened(gameRecord(stored(['e4', 'e5']), names));
    expect(read.tags['White']).toBe('Deleted account');
    expect(read.tags['Black']).toBe("say 'hi' / bye");
    expect(read.moves).toEqual(['e4', 'e5']);
  });

  test('a person without a rating on the game has no rating tag', () => {
    const game = stored(['e4', 'e5'], { white_rating: null, black_rating: '' });
    const { tags } = opened(gameRecord(game, NAMES));
    expect(tags['WhiteElo']).toBeUndefined();
    expect(tags['BlackElo']).toBeUndefined();
  });

  test.each(['ongoing', 'aborted'] as const)(
    'a game that is %s has no game record',
    (outcome) => {
      expect(gameRecord(stored(['e4'], { outcome }), NAMES)).toBeNull();
    }
  );
});
