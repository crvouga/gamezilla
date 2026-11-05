import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpacesScreenView } from './spaces-screen-view';
import {
  FRIEND_SPACE,
  HOSTED_SPACE,
  JOINED_SPACE,
  LOBBY_SPACES,
  LONG_SPACE,
  SECOND_HOSTED_SPACE,
} from './spaces-story.example';

const meta = {
  id: 'screens-spaces-lobby',
  title: 'Screens/Spaces/Spaces',
  component: SpacesScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['spaces', 'notice'] },
  },
  args: {
    status: 'ready',
    hostedCount: 2,
    spaces: LOBBY_SPACES,
    onCreateSpace: fn(() => Promise.resolve()),
    onOpenSpace: fn(),
  },
} satisfies Meta<typeof SpacesScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An active person's lobby: under "Hosting 2 spaces" the one open here
 * ("Resume") and their other ("Open"), then under "Shared with you" four
 * friends' spaces, from filling up to "No guests yet", each "Join". Every
 * space wears its own mark (its colour and initial), the host's face is
 * secondary, and every row has the same anatomy: name, host and guests,
 * with what pressing it does at its trailing edge.
 */
export const Populated: Story = {};

/** Local data has not answered yet: one activity indicator, never "No spaces yet". */
export const Loading: Story = {
  args: { status: 'loading', hostedCount: 0, spaces: [] },
};

/** The lobby has answered with nothing: the empty state offers to start one. */
export const Empty: Story = { args: { hostedCount: 0, spaces: [] } };

/**
 * Spaces to join but none hosted: no "Hosting" group, only "Shared with
 * you"; a lone card spans the row on a wide screen.
 */
export const JoinableOnly: Story = {
  args: { hostedCount: 0, spaces: [JOINED_SPACE] },
};

/** Hosting more than one space (kept after paid access ended). */
export const HostingSeveral: Story = {
  args: {
    hostedCount: 2,
    spaces: [HOSTED_SPACE, SECOND_HOSTED_SPACE, LONG_SPACE],
  },
};

/** Long titles and names truncate to one line inside the card. */
export const LongContent: Story = {
  args: { spaces: [LONG_SPACE, JOINED_SPACE] },
};

/** A refused create / end / leave is told inline above the list. */
export const WithRefusedChange: Story = {
  render: (args) => (
    <SpacesScreenView
      {...args}
      notice={
        <Notice tone="error">Your space couldn't be started. Try again.</Notice>
      }
    />
  ),
};

/** Pressing a card opens that space; the header action starts a new one. */
export const OpenAndCreate: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.spaceCard('robin_42'))
    );
    await expect(args.onOpenSpace).toHaveBeenCalledWith(FRIEND_SPACE.spaceId);
    await userEvent.click(await canvas.findByTestId(Handles.spaceCreate));
    await expect(args.onCreateSpace).toHaveBeenCalled();
  },
};
