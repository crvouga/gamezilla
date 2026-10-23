import { expect, test } from 'bun:test';
import {
  GAME_SIDES,
  type GameRecordMetadata,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';

test('a declared roster and its record hold four participants while older games keep two', () => {
  const participants: GameRecordMetadata['participants'] = [
    'Alice',
    'Bob',
    'Carol',
    'Dave',
  ].map((name) => ({ name, rating: null }));
  expect(gameSides({ sides: GAME_SIDES })).toEqual([
    'white',
    'black',
    'red',
    'blue',
  ]);
  expect(gameSides({})).toEqual(['white', 'black']);
  expect(participants).toHaveLength(4);
});
