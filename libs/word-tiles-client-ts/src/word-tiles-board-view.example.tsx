import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import {
  DEFAULT_LEXICON_KEY,
  ENABLE_LEXICON,
  type Lexicon,
} from '@libs/word-tiles-shared-ts/word-tiles-lexicon';
import { EMPTY_BOARD } from '@libs/word-tiles-shared-ts/word-tiles-position';
import { buildWordTrie } from '@libs/word-tiles-shared-ts/word-tiles-trie';
import type { LexiconState } from './use-word-tiles-lexicon';

/** The words the Word Tiles stories spell; anything else is not in this list. */
const STORY_WORDS = new Set(['CAT', 'TOE', 'CATS', 'TEA', 'EAT']);

/**
 * Story-only: a loaded word list holding just the stories' words, so the
 * preview checks words without decoding the full list in every story.
 */
export const STORY_LEXICON: LexiconState = {
  status: 'ready',
  lexicon: {
    identity: ENABLE_LEXICON,
    trie: buildWordTrie(''),
    has: (word) => STORY_WORDS.has(word),
  } satisfies Lexicon,
};

/** The word list the stories' positions and puzzles pin. */
export const STORY_LEXICON_KEY = DEFAULT_LEXICON_KEY;

/** An empty board with `words` written on it, each from its first cell. */
export function boardWith(
  words: readonly {
    readonly from: string;
    readonly letters: string;
    readonly down?: boolean;
  }[]
): string {
  const cells = EMPTY_BOARD.split('');
  for (const word of words) {
    const start = parseCell(word.from);
    if (start === null) throw new Error(`No cell ${word.from}`);
    word.letters.split('').forEach((letter, at) => {
      cells[start + at * (word.down === true ? 15 : 1)] = letter;
    });
  }
  return cells.join('');
}

/** CAT across the centre star, and TOE down from its T. */
export const CAT_AND_TOE = boardWith([
  { from: 'g8', letters: 'CAT' },
  { from: 'i8', letters: 'TOE', down: true },
]);
