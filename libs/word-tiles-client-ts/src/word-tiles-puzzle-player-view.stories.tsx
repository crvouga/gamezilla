import { evaluatePlacement } from '@libs/word-tiles-shared-ts/word-tiles-placement';
import {
  encodePuzzle,
  placementOf,
  rackTileIds,
  type WordTilesPuzzle,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { RULESET } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { createSignal } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import type { LexiconState } from './use-word-tiles-lexicon';
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
    onRetryLexicon: fn(),
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
  render: (args) => {
    const [lexicon, setLexicon] = createSignal(args.lexicon);
    return (
      <WordTilesPuzzlePlayerView
        {...args}
        lexicon={lexicon()}
        onRetryLexicon={() => setLexicon(STORY_LEXICON)}
      />
    );
  },
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

/** A real placement is scored by the domain evaluator and fed back into the player. */
export const ReachTarget: Story = {
  args: { definition: encodePuzzle({ ...PUZZLE, target: 6 }) },
  render: (args) => {
    const [state, setState] = createSignal(args.state);
    const [lexicon, setLexicon] = createSignal<LexiconState>({
      status: 'unavailable',
      reason: 'offline',
    });
    return (
      <WordTilesPuzzlePlayerView
        {...args}
        state={state()}
        lexicon={lexicon()}
        onRetryLexicon={() => setLexicon(STORY_LEXICON)}
        onAction={(action) => {
          const placed = placementOf(PUZZLE, action);
          if (placed === null) throw new Error('Invalid puzzle action');
          const result = evaluatePlacement(PUZZLE.board, placed);
          if (!result.ok) throw new Error('Invalid puzzle placement');
          setState(
            JSON.stringify({ v: 1, played: action, score: result.score.total })
          );
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Try a disconnected tile, then recover using the player's own recall action.
    await userEvent.click(canvas.getByTestId('word-tiles-puzzle-rack-0'));
    await userEvent.click(canvas.getByTestId('word-tiles-puzzle-cell-a1'));
    await expect(canvas.getByTestId('word-tiles-puzzle-submit')).toBeDisabled();
    await userEvent.click(canvas.getByTestId('word-tiles-puzzle-recall'));
    // Extend CAT to CATS on the triple-letter square at j8.
    await userEvent.click(
      canvas.getByTestId(
        `word-tiles-puzzle-rack-${rackTileIds(PUZZLE.rack)[2]}`
      )
    );
    await userEvent.click(canvas.getByTestId('word-tiles-puzzle-cell-j8'));
    // regression: word-tiles-puzzle-retry-keeps-draft
    await expect(canvas.getByTestId('word-tiles-puzzle-submit')).toBeDisabled();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Retry word list' })
    );
    await expect(
      canvas.getByTestId('word-tiles-puzzle-cell-j8')
    ).toHaveTextContent('S');
    await expect(canvas.getByTestId('word-tiles-puzzle-submit')).toBeEnabled();
    await userEvent.click(canvas.getByTestId('word-tiles-puzzle-submit'));
    await expect(
      canvas.getByTestId('word-tiles-puzzle-score')
    ).toHaveTextContent('8 of 6');
    // regression: word-tiles-puzzle-completion-remains-editable
    await expect(
      canvas.getByTestId('word-tiles-puzzle-complete')
    ).toHaveTextContent('Puzzle solved');
    await expect(
      canvas.queryByTestId('word-tiles-puzzle-submit')
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByTestId('word-tiles-puzzle-cell-j8')
    ).toHaveAccessibleName(/committed/);
  },
};

/** Assign a blank through the enlarged board and retain its chosen letter. */
export const EnlargedBlank: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enlarge board' })
    );
    await userEvent.click(
      canvas.getByTestId(
        `word-tiles-puzzle-rack-${rackTileIds(PUZZLE.rack)[4]}`
      )
    );
    await userEvent.click(canvas.getByTestId('word-tiles-puzzle-cell-j8'));
    await userEvent.click(canvas.getByTestId('word-tiles-puzzle-blank-S'));
    await expect(
      canvas.getByTestId('word-tiles-puzzle-cell-j8')
    ).toHaveAccessibleName(/blank as S/);
    await expect(canvas.getByTestId('word-tiles-puzzle-submit')).toBeEnabled();
  },
};
