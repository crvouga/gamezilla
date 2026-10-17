import { expect, test } from 'bun:test';
import { assertGameScreens } from '@libs/game-menu-client/shared-game-screens';

test('a game may declare its own distinct slug screens', () => {
  expect(() =>
    assertGameScreens('chess', ['puzzle', 'stats', 'stats-review'])
  ).not.toThrow();
});

test('a game cannot take a screen the platform owns', () => {
  for (const screen of [
    'choices',
    'custom-game',
    'multiplayer',
    'history',
    'settings',
  ])
    expect(() => assertGameScreens('race', [screen])).toThrow('platform');
});

test('a duplicate or malformed screen key fails when the game is defined', () => {
  expect(() => assertGameScreens('race', ['lap', 'lap'])).toThrow('twice');
  expect(() => assertGameScreens('race', ['Lap One'])).toThrow('slug');
});
