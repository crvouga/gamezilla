import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ChessSettingsDeveloperScreenView } from './chess-settings-developer-screen-view';

const meta = {
  id: 'screens-games-chess-developer',
  title: 'Screens/Games/Chess/Developer',
  component: ChessSettingsDeveloperScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { canManagePuzzles: true, onOpenPuzzles: fn() },
} satisfies Meta<typeof ChessSettingsDeveloperScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A person who manages puzzles is offered loading puzzle content. */
export const CanManagePuzzles: Story = {};

/** Without the puzzle permission nothing is offered: the list is empty. */
export const CannotManagePuzzles: Story = {
  args: { canManagePuzzles: false },
};

/** Choosing the puzzle loader opens it. */
export const OpenPuzzles: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('chess-developer-puzzles'));
    await expect(args.onOpenPuzzles).toHaveBeenCalled();
  },
};
