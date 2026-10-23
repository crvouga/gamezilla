import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_PUZZLE_FEED_CONFIG,
  readPuzzleFeedConfig,
} from '@libs/game-puzzle-shared-ts/feed-config';

/**
 * The move notation in a feed's stored choices is the game's own key: the
 * platform keeps it verbatim and stores '' — the game's default — when none
 * was chosen; a stored key stays readable whatever wrote it.
 */
describe('notation in the stored feed choices', () => {
  test("defaults to the game's own default", () => {
    expect(DEFAULT_PUZZLE_FEED_CONFIG.notation).toBe('');
  });

  test('a legacy row without the field still decodes, to the default', () => {
    expect(
      readPuzzleFeedConfig({ mode: 'auto', customRating: 1500 })?.notation
    ).toBe('');
  });

  test('a stored key round-trips verbatim', () => {
    for (const notation of ['san', 'figurine'])
      expect(
        readPuzzleFeedConfig({ ...DEFAULT_PUZZLE_FEED_CONFIG, notation })
          ?.notation
      ).toBe(notation);
  });

  test('an unusable key falls back to the default rather than voiding the row', () => {
    for (const notation of ['not a key', 7, 'x'.repeat(33)]) {
      const decoded = readPuzzleFeedConfig({
        ...DEFAULT_PUZZLE_FEED_CONFIG,
        notation,
      });
      expect(decoded).toBeDefined();
      expect(decoded?.notation).toBe('');
    }
  });
});
