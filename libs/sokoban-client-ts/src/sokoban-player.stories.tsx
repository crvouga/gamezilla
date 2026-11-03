import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SokobanPlayer } from './sokoban-player';
import {
  playedTwoCrates,
  SOLVING_MOVES,
  TWO_CRATES,
} from './sokoban-player.example';

const meta = {
  id: 'screens-games-sokoban-puzzle',
  title: 'Screens/Games/Sokoban/Puzzle',
  component: SokobanPlayer,
  tags: ['autodocs'],
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
    await userEvent.click(await canvas.findByTestId('sokoban-move-left'));
    await expect(
      await canvas.findByTestId('sokoban-refusal')
    ).toHaveTextContent("The worker's way is blocked.");
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};
