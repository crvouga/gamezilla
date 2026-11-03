import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ChessSettingsScreenView } from './chess-settings-screen-view';

const meta = {
  id: 'screens-games-chess-settings',
  title: 'Screens/Games/Chess/Settings',
  component: ChessSettingsScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { onOpenDeveloper: fn() },
} satisfies Meta<typeof ChessSettingsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The settings menu: the developer tools are its one entry. */
export const Default: Story = {};

/** Choosing Developer opens the developer tools. */
export const OpenDeveloper: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-settings-developer')
    );
    await expect(args.onOpenDeveloper).toHaveBeenCalled();
  },
};
