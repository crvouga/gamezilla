import { expect, test } from 'bun:test';
import { sokobanGameClient } from '@libs/sokoban-client-ts/sokoban-game-client';
import { initialSokobanDefinition } from '@libs/sokoban-shared-ts/sokoban-board-edits';

// regression: sokoban-unreadable-draft-offers-playtest
test('an unreadable Sokoban draft is not offered for playtest', () => {
  const readable = sokobanGameClient.puzzleContent.authoring?.readable;
  expect(readable).toBeDefined();
  expect(readable?.(initialSokobanDefinition())).toBe(true);
  expect(readable?.('not a board')).toBe(false);
  expect(readable?.(JSON.stringify({ format: 1, rows: [] }))).toBe(false);
});
