import {
  encodePuzzle,
  readPuzzle,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CAT_AND_TOE } from './word-tiles-board-view.example';
import {
  initialWordTilesPuzzle,
  WordTilesPuzzleEditorView,
} from './word-tiles-puzzle-editor';

const INITIAL = initialWordTilesPuzzle();
const read = readPuzzle(INITIAL);
const WITH_WORDS = read.valid
  ? encodePuzzle({ ...read.value, board: CAT_AND_TOE, target: 24 })
  : INITIAL;

const meta = {
  id: 'screens-games-word-tiles-editor',
  title: 'Screens/Games/Word Tiles/Puzzle editor',
  component: WordTilesPuzzleEditorView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['onChange'] } },
  args: { definition: INITIAL, disabled: false, onChange: fn() },
} satisfies Meta<typeof WordTilesPuzzleEditorView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new challenge: an empty board, a starting rack and a modest target. */
export const NewPuzzle: Story = {};

/** Words painted on the board, joined through the centre square. */
export const WithBoardWords: Story = { args: { definition: WITH_WORDS } };

/** While the shared builder saves or publishes, nothing can be edited. */
export const Disabled: Story = {
  args: { definition: WITH_WORDS, disabled: true },
};

/** A draft this app cannot read points at an earlier saved copy. */
export const Unreadable: Story = { args: { definition: 'not a puzzle' } };
