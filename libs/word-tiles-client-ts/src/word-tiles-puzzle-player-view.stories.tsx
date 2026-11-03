import {
  encodePuzzle,
  type WordTilesPuzzle,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { RULESET } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  CAT_AND_TOE,
  STORY_LEXICON,
  STORY_LEXICON_KEY,
} from './word-tiles-board-view.example';
import { WordTilesPuzzlePlayerView } from './word-tiles-puzzle-player-view';

const PUZZLE: WordTilesPuzzle = {
  ruleset: RULESET.id,
  lexicon: STORY_LEXICON_KEY,
  board: CAT_AND_TOE,
  rack: 'AEST?RN',
  target: 20,
};

const meta = {
  id: 'screens-games-word-tiles-puzzle',
  title: 'Screens/Games/Word Tiles/Puzzle',
  component: WordTilesPuzzlePlayerView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['onAction', 'lexicon'] },
  },
  args: {
    definition: encodePuzzle(PUZZLE),
    state: JSON.stringify({ v: 1, played: null, score: null }),
    disabled: false,
    lexicon: STORY_LEXICON,
    onAction: fn(),
  },
} satisfies Meta<typeof WordTilesPuzzlePlayerView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A fresh attempt: the target, the frozen board and the rack. */
export const Ready: Story = {};

/** The last move fell short: its score against the target. */
export const AfterAMove: Story = {
  args: {
    state: JSON.stringify({ v: 1, played: 'play:j9=0', score: 12 }),
  },
};

/** The attempt is over: the board shows, but no tile can be placed. */
export const Disabled: Story = { args: { disabled: true } };

/** The word list did not load: moves are scored, not checked. */
export const WordListUnavailable: Story = {
  args: {
    lexicon: {
      status: 'unavailable',
      reason: 'Word list enable1.90ef7a729517 is unavailable',
    },
  },
};

/** A definition this app cannot read says to update the app. */
export const Unreadable: Story = { args: { definition: '{}' } };

/** E and A placed under TOE spell a word the list lacks: the preview says so. */
export const PlaceAWord: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const [tile, cell] of [
      ['17', 'i11'],
      ['0', 'i12'],
    ] as const) {
      await userEvent.click(
        await canvas.findByTestId(`word-tiles-puzzle-rack-${tile}`)
      );
      await userEvent.click(
        await canvas.findByTestId(`word-tiles-puzzle-cell-${cell}`)
      );
    }
    await expect(
      await canvas.findByTestId('word-tiles-puzzle-status')
    ).toHaveTextContent('Not in the word list');
  },
};
