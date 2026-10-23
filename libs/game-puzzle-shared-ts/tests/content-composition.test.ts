import { expect, test } from 'bun:test';
import {
  GAME_PUZZLE_SERVER,
  gamePuzzleServers,
} from '@libs/game-puzzle-shared-ts/puzzle-sub-server';
import { gamePuzzleSubs } from '@libs/game-puzzle-shared-ts/sub';
import { composeSubs } from '@libs/sub-shared-ts/compose';
import { pileContent } from './pile-game';

test('a puzzle-only registration mounts shared persistence and injects its rules without a turn game', () => {
  const puzzleContent = pileContent();
  const games = [{ id: 'pile', puzzleContent }];
  expect(() => gamePuzzleSubs(games)).not.toThrow();
  const app = composeSubs(gamePuzzleSubs(games));
  expect(app.turnGames.games).toEqual([]);
  expect(app.puzzleContents.byId('pile')).toBe(puzzleContent);
  expect(app.tableNames).toContain('puzzle_content_attempts');
  expect(app.sessionQueries).toContain('puzzleContentPublished');
  expect(gamePuzzleServers(games)).toEqual([GAME_PUZZLE_SERVER]);
  expect(gamePuzzleSubs([{ id: 'plain' }])).toEqual([]);
  expect(gamePuzzleServers([{ id: 'plain' }])).toEqual([]);
});
