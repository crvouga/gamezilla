import { expect, test } from 'bun:test';
import { quoridorHillGameClient } from '@libs/quoridor-client-ts/quoridor-game-client';

test('Hill introduction identifies the center destination and its coordinate', () => {
  // regression: quoridor-hill-coordinate-only-goal
  expect(quoridorHillGameClient.caption).toContain('center hill (e5)');
  expect(quoridorHillGameClient.caption).toContain('wins');
});
