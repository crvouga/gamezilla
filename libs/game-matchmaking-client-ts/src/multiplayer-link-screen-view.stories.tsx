import { HouseIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerLinkScreenView } from './multiplayer-link-screen-view';

const meta = {
  id: 'screens-games-matchmaking-link',
  title: 'Screens/Games/Matchmaking/Multiplayer link',
  component: MultiplayerLinkScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['denial'] } },
  args: {
    status: 'opening',
    onRetry: fn(),
    onGoToSpaces: fn(),
  },
} satisfies Meta<typeof MultiplayerLinkScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Opening the person's own space; it normally finishes at once. */
export const Opening: Story = {};

/** Opening failed or stalled: nothing is lost, try again or go to Spaces. */
export const Failed: Story = { args: { status: 'failed' } };

/** The person hosts as many spaces as they may: the limit's way forward. */
export const SpaceLimited: Story = {
  args: {
    status: 'limited',
    denial: {
      icon: HouseIcon,
      title: 'You have reached your space limit',
      body: 'End a space you host to open another.',
      dataSet: { testid: 'permission-denial', reason: 'limit_reached' },
    },
  },
};

/** A link to a game that offers no matchmaking: pick a game from the list. */
export const Unavailable: Story = { args: { status: 'unavailable' } };

/** Trying again starts the opening over. */
export const Retry: Story = {
  args: { status: 'failed' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-link-retry'));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
