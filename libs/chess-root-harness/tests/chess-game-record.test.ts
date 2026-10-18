import { describe, expect, test } from 'bun:test';
import { chessTurnGame } from '@libs/chess-sub-shared/chess-game';
import type { GameRecordMetadata } from '@pkgs/turn-game-shared/game-rules';
import { Chess } from 'chess.js';

/** Chess's game record, as the framework asks for it (`history.record`). */
const record = chessTurnGame.capabilities.history!.record;

const FIVE_MINUTES = { minutes: 5, incrementSeconds: 0, daysPerMove: 0 };

/** A finished game after these moves, as the framework describes it. */
function written(
  moves: readonly string[],
  patch: Partial<GameRecordMetadata> = {}
): string {
  const board = new Chess();
  for (const move of moves) board.move(move);
  return record(board.fen(), board.pgn(), {
    participants: [
      { name: 'alice', rating: '1500?' },
      { name: 'bob', rating: '1482' },
    ],
    outcome: 'white',
    reason: 'resignation',
    timeControl: FIVE_MINUTES,
    ...patch,
  });
}

/** The record as another chess program reads it. */
function opened(text: string) {
  const board = new Chess();
  board.loadPgn(text, { strict: true });
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
      const text = written(moves, { outcome });
      const read = opened(text);
      expect(read.moves).toEqual(moves);
      expect(read.tags['Result']).toBe(result);
      expect(text.trimEnd().endsWith(` ${result}`)).toBe(true);
    }
  );

  test('it names both people, the time control and their ratings', () => {
    expect(opened(written(['e4', 'e5'])).tags).toMatchObject({
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
    [{ minutes: 2, incrementSeconds: 1, daysPerMove: 0 }, '120+1'],
    [{ minutes: 30, incrementSeconds: 20, daysPerMove: 0 }, '1800+20'],
    [{ minutes: 1440, incrementSeconds: 0, daysPerMove: 1 }, '1/86400'],
    [{ minutes: 4320, incrementSeconds: 0, daysPerMove: 3 }, '1/259200'],
    [null, '?'],
  ])('the time control %o is written %s', (timeControl, text) => {
    expect(
      opened(written(['e4', 'e5'], { timeControl })).tags['TimeControl']
    ).toBe(text);
  });

  test('a game lost on time says so', () => {
    const text = written(['e4', 'e5'], { outcome: 'black', reason: 'timeout' });
    expect(opened(text).tags['Termination']).toBe('time forfeit');
  });

  test('a name is written so the record still opens', () => {
    const read = opened(
      written(['e4', 'e5'], {
        participants: [
          { name: 'Deleted account', rating: null },
          { name: 'say "hi" \\ bye', rating: null },
        ],
      })
    );
    expect(read.tags['White']).toBe('Deleted account');
    expect(read.tags['Black']).toBe("say 'hi' / bye");
    expect(read.moves).toEqual(['e4', 'e5']);
  });

  test('a person without a rating on the game has no rating tag', () => {
    const { tags } = opened(
      written(['e4', 'e5'], {
        participants: [
          { name: 'alice', rating: null },
          { name: 'bob', rating: '' },
        ],
      })
    );
    expect(tags['WhiteElo']).toBeUndefined();
    expect(tags['BlackElo']).toBeUndefined();
  });
});
