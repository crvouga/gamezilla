import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MatchmakingScreenView } from './matchmaking-screen-view';
import {
  renderStory,
  STORY_PARAMETERS,
  storyArgs,
} from './matchmaking-screen-view.example';

const meta = {
  id: 'screens-matchmaking-status',
  title: 'Screens/Space/Matchmaking/Status',
  component: MatchmakingScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) => renderStory()(args),
  args: {
    ...storyArgs(),
    stage: 'loading',
    place: { screen: 'status' },
  },
} satisfies Meta<typeof MatchmakingScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Still reading the game and search the space's host holds. */
export const Loading: Story = {};

/** A watcher in a space whose host has no game: the way back is one press. */
export const Unavailable: Story = { args: { stage: 'unavailable' } };

/** Someone who may not watch this space's game sees the way forward. */
export const Denied: Story = {
  args: {
    stage: 'denied',
    denial: {
      icon: KeyRoundIcon,
      title: 'Sign in to find an opponent',
      body: 'Matched games are rated and need an account.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: {
        testid: 'multiplayer-access-denial',
        reason: 'requires_account',
      },
    },
  },
};

/** Offline while there is nothing to watch: the notice sits above the reason. */
export const UnavailableOffline: Story = {
  args: { stage: 'unavailable', online: false },
};

/** Leaving for the game's choices from a space with no game to watch. */
export const LeaveUnavailable: Story = {
  args: { stage: 'unavailable' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Back to Connect Four' })
    );
    await expect(args.onLeave).toHaveBeenCalled();
  },
};
