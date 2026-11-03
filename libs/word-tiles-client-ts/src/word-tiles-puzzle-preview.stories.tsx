import { encodePuzzle } from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { RULESET } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  CAT_AND_TOE,
  STORY_LEXICON_KEY,
} from './word-tiles-board-view.example';
import { WordTilesPuzzlePreview } from './word-tiles-puzzle-player';

const meta = {
  id: 'screens-games-word-tiles-puzzle-preview',
  title: 'Screens/Games/Word Tiles/Puzzle preview',
  component: WordTilesPuzzlePreview,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: {
    definition: encodePuzzle({
      ruleset: RULESET.id,
      lexicon: STORY_LEXICON_KEY,
      board: CAT_AND_TOE,
      rack: 'AEST?RN',
      target: 20,
    }),
  },
} satisfies Meta<typeof WordTilesPuzzlePreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The board, the rack (a blank as a dot) and the target, before any move. */
export const Default: Story = {};

/** A definition this app cannot show says so. */
export const Unreadable: Story = { args: { definition: '{}' } };
