import {
  StoryPackAttempt,
  type StoryPackPuzzle,
} from '@libs/game-puzzle-client-ts/content-attempt-story.example';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SokobanPlayer } from './sokoban-player';
import {
  playedTwoCrates,
  SOLVING_MOVES,
  TWO_CRATES,
} from './sokoban-player.example';

/** The starter pack's two-crate puzzle, as a person plays it from the pack. */
const PUZZLE: StoryPackPuzzle = {
  title: 'Two crates',
  difficulty: 'Easy',
  description: 'Push each of the two crates onto its own goal.',
  pack: { title: 'Warehouse basics', position: 3, total: 4 },
};

const meta = {
  id: 'screens-games-sokoban-puzzle',
  title: 'Screens/Games/Sokoban/Puzzle',
  component: SokobanPlayer,
  tags: ['autodocs'],
  // The player inside the screen a pack puzzle is played on.
  render: (args) => (
    <StoryPackAttempt
      puzzle={PUZZLE}
      disabled={args.disabled}
      complete={sokobanPuzzleContent.rules.complete(
        args.definition,
        args.state
      )}
      player={<SokobanPlayer {...args} />}
    />
  ),
  parameters: { appRouter: true, controls: { exclude: ['onAction'] } },
  args: {
    definition: TWO_CRATES,
    state: playedTwoCrates([]),
    disabled: false,
    onAction: fn(),
  },
} satisfies Meta<typeof SokobanPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The start: the worker beside two crates, two goals to fill. */
export const Fresh: Story = {};

/** One crate pushed onto its goal; moves and pushes counted. */
export const InProgress: Story = {
  args: { state: playedTwoCrates(SOLVING_MOVES.slice(0, 2)) },
};

/** Every crate on a goal. */
// regression: solved-pack-story-completion
export const Solved: Story = {
  args: { state: playedTwoCrates(SOLVING_MOVES), disabled: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByTestId('content-attempt-complete')
    ).toHaveTextContent('Puzzle completed');
  },
};

/** While the shared player is not taking moves, the board stays still. */
export const Disabled: Story = { args: { disabled: true } };

/** A puzzle this app cannot open points back to its overview. */
export const Unreadable: Story = { args: { definition: '{}' } };

/** Walking into the wall is refused, with the reason, and sends nothing. */
// regression: sokoban-blocked-move-wide-story
export const BlockedMove: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const pad = canvas.queryByTestId('sokoban-move-left');
    if (pad?.checkVisibility()) {
      await userEvent.click(pad);
    } else {
      const board = await canvas.findByTestId('sokoban-board');
      await expect(board).toBeVisible();
      board.focus();
      await expect(board).toHaveFocus();
      await userEvent.keyboard('{ArrowLeft}');
    }
    await expect(
      await canvas.findByTestId('sokoban-refusal')
    ).toHaveTextContent("The worker's way is blocked.");
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};
