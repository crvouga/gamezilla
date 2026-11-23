import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { GameHistoryHubScreenView } from './game-history-hub-screen-view';

const meta = {
  id: 'screens-games-history-hub',
  title: 'Screens/Space/Main menu/History and stats',
  component: GameHistoryHubScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { onOpen: fn() },
} satisfies Meta<typeof GameHistoryHubScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A game with played games and puzzles: one row to each look back. */
export const Hub: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('game-choice-stats'));
    await expect(args.onOpen).toHaveBeenCalledWith('stats');
  },
};
