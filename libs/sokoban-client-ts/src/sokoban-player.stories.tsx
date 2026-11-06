import {
  StoryPackAttempt,
  type StoryPackPuzzle,
} from '@libs/game-puzzle-client-ts/content-attempt-story.example';
import { decodeSokobanAction } from '@libs/sokoban-shared-ts/sokoban-position';
import type { SokobanDirection } from '@libs/sokoban-shared-ts/sokoban-types';
import { createSignal } from 'solid-js';
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
      complete={args.state === playedTwoCrates(SOLVING_MOVES)}
      disabled={args.disabled}
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
export const Solved: Story = {
  args: { state: playedTwoCrates(SOLVING_MOVES), disabled: true },
};

/** While the shared player is not taking moves, the board stays still. */
export const Disabled: Story = { args: { disabled: true } };

/** A puzzle this app cannot open points back to its overview. */
export const Unreadable: Story = { args: { definition: '{}' } };

/** Walking into the wall is refused, with the reason, and sends nothing. */
export const BlockedMove: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // regression: sokoban-desktop-blocked-move-pad
    (await canvas.findByTestId('sokoban-board')).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(
      await canvas.findByTestId('sokoban-refusal')
    ).toHaveTextContent("The worker's way is blocked.");
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};

/** Real rule transitions from the first push to every crate on a goal. */
export const SolveWithKeyboard: Story = {
  render: () => {
    const [moves, setMoves] = createSignal<readonly SokobanDirection[]>([]);
    return (
      <StoryPackAttempt
        puzzle={PUZZLE}
        complete={moves().length === 7}
        player={
          <SokobanPlayer
            definition={TWO_CRATES}
            state={playedTwoCrates(moves())}
            disabled={moves().length === 7}
            onAction={(action) => {
              const decoded = decodeSokobanAction(action);
              if (!decoded.valid) throw new Error('Invalid story move');
              setMoves((previous) => [...previous, decoded.value]);
            }}
          />
        }
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    (await canvas.findByTestId('sokoban-board')).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(await canvas.findByTestId('sokoban-refusal')).toBeVisible();
    for (const key of [
      'ArrowRight',
      'ArrowRight',
      'ArrowLeft',
      'ArrowLeft',
      'ArrowUp',
      'ArrowRight',
      'ArrowRight',
    ]) {
      await userEvent.keyboard(`{${key}}`);
    }
    await expect(await canvas.findByTestId('sokoban-counts')).toHaveAttribute(
      'data-moves',
      '7'
    );
    await expect(canvas.getByTestId('sokoban-counts')).toHaveAttribute(
      'data-pushes',
      '4'
    );
    await expect(canvas.getByTestId('sokoban-complete')).toHaveTextContent(
      'Every crate is on a goal'
    );
    await expect(
      canvas.queryByTestId('sokoban-refusal')
    ).not.toBeInTheDocument();
  },
};
