import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example, { type GameLobbyExampleProps } from './game-lobby.example';
import { GameLobbyScreen } from './index';

const meta = {
  id: 'product-game-lobby',
  title: 'Games/Shared/Components/GameLobby',
  component: GameLobbyScreen,
  tags: ['autodocs'],
  args: {
    players: 2,
    ready: false,
    summary: true,
    onReady: fn(),
    onLeave: fn(),
  },
  argTypes: {
    players: { control: { type: 'number', min: 1, max: 7 } },
    ready: { control: 'boolean' },
    summary: { control: 'boolean' },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['players', 'ready', 'summary'] },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<GameLobbyExampleProps>;
export default meta;

type Story = StoryObj<GameLobbyExampleProps>;

/** The mode card, the roster, and the one command in the dock. */
export const Lobby: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Connect Four' })
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: "I'm ready" }));
    await expect(args.onReady).toHaveBeenCalledTimes(1);
  },
};

/** The person is ready: the command becomes the way back. */
export const Ready: Story = { args: { ready: true } };

/** A long roster scrolls under the dock, which stays put. */
export const LongRoster: Story = { args: { players: 7 } };

/** No line about the game: the card closes up. */
export const NoSummary: Story = { args: { summary: false } };
