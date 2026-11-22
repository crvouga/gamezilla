import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceChoosingScreenView } from './space-choosing-screen-view';
import { GAMES } from './spaces-story.example';

const meta = {
  id: 'screens-spaces-games',
  title: 'Screens/Spaces/Games',
  component: SpaceChoosingScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['games'] } },
  args: { games: GAMES, canSelectGame: true, onSelectGame: fn() },
} satisfies Meta<typeof SpaceChoosingScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The host's space before a game is picked, as the product wires it: the
 * catalogue's `Templates/Space/SpaceLauncher` (the stage template with the launcher) over
 * the space's own chrome and the registered games.
 */
export const HostChoosing: Story = {};

/** Someone who cannot pick sees the same games and that the host is choosing. */
export const GuestWaiting: Story = { args: { canSelectGame: false } };

/** Pressing a game as host selects it for the whole space. */
export const SelectGame: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('game-menu-example-cards'));
    await expect(args.onSelectGame).toHaveBeenCalledWith('example-cards');
  },
};
