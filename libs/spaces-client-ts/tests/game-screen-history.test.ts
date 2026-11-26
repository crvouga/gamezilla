import { expect, test } from 'bun:test';
import { GameScreenHistory } from '@libs/spaces-client-ts/game-screen-history';

test('a rematch or reopening a minimized board keeps its last visited space screen', () => {
  const history = new GameScreenHistory();
  const visit = (screen: string) =>
    history.visit('friday', 'first-game', screen);
  visit('choices');
  visit('custom-game');
  visit('history');
  visit('custom-game');
  visit('custom-game');
  history.visit('saturday', 'first-game', 'settings');
  expect(history.back('friday', 'first-game', 'custom-game')).toBe('history');
  expect(history.back('friday', 'first-game', 'history')).toBe('choices');
});

test('direct entry and a newly selected game fall back to their own choices', () => {
  const history = new GameScreenHistory();
  history.visit('friday', 'first-game', 'settings');
  history.visit('friday', 'second-game', 'multiplayer');
  expect(history.back('friday', 'second-game', 'multiplayer')).toBe('choices');
  history.visit('friday', 'second-game', 'settings');
  history.forget('friday');
  expect(history.back('friday', 'second-game', 'multiplayer')).toBe('choices');
});
