import { expect, test } from 'bun:test';
import { contentDraftPlayable } from '@libs/game-puzzle-client-ts/content-draft-playable';
import type { PuzzleContentClient } from '@libs/game-puzzle-client-ts/puzzle-content-client';

/** A game whose authoring reads only the definition `board`. */
const game = {
  authoring: { readable: (definition: string) => definition === 'board' },
} as unknown as PuzzleContentClient;

// regression: builder-pack-preview-locked-by-puzzle-readable
test("a pack draft stays playable though its definition is not a game's board", () => {
  expect(contentDraftPlayable(game, 'pack', '["river","valley"]')).toBe(true);
});

test('a puzzle draft is playable only when the game can read its board', () => {
  expect(contentDraftPlayable(game, 'puzzle', 'board')).toBe(true);
  expect(contentDraftPlayable(game, 'puzzle', 'not a board')).toBe(false);
});

test('a game without readable() leaves every draft playable', () => {
  const plain = { authoring: {} } as unknown as PuzzleContentClient;
  expect(contentDraftPlayable(plain, 'puzzle', 'anything')).toBe(true);
});
