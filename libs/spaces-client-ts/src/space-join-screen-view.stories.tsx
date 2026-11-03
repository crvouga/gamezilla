import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceJoinScreenView } from './space-join-screen-view';
import { FRIEND_SPACE, JOINED_SPACE, LONG_SPACE } from './spaces-story.example';

const meta = {
  id: 'screens-spaces-join',
  title: 'Screens/Spaces/Join space',
  component: SpaceJoinScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['space'] },
  },
  args: {
    title: JOINED_SPACE.title,
    status: 'live',
    connection: 'ready',
    needsConnection: false,
    space: JOINED_SPACE,
    canLeave: false,
    joinPending: false,
    joinDisabled: false,
    onJoin: fn(() => Promise.resolve()),
    onJoinPhaseChange: fn(),
    onLeave: fn(),
    onBackToSpaces: fn(),
  },
} satisfies Meta<typeof SpaceJoinScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A live space with guests: who hosts, who is there, and Join. */
export const Live: Story = {};

/** A live space nobody has joined yet: no guest section, still Join. */
export const LiveNoGuests: Story = {
  args: { title: FRIEND_SPACE.title, space: FRIEND_SPACE },
};

/** The host's connection is still being checked: no Join until it is known. */
export const CheckingHost: Story = { args: { connection: 'loading' } };

/** An earlier join was not confirmed: Join offers to check again. */
export const JoinNotConfirmed: Story = { args: { joinPending: true } };

/** Joining was tried without a connection: said plainly above the space. */
export const JoinNeedsConnection: Story = { args: { needsConnection: true } };

/** The device has nothing on this space and cannot ask the server. */
export const Offline: Story = {
  args: {
    status: 'offline',
    connection: 'offline',
    needsConnection: true,
    space: null,
    title: 'Space',
  },
};

/** The host is away: a person on the list may still leave it. */
export const HostOffline: Story = {
  args: { connection: 'host-offline', canLeave: true },
};

/** The host is away and the viewer is not on its list: nothing to press. */
export const HostOfflineNotOnList: Story = {
  args: { connection: 'host-offline', canLeave: false },
};

/** Still reading the space from this device or the server. */
export const Loading: Story = {
  args: { status: 'loading', space: null, title: 'Space' },
};

/** Not the host's friend nor added: told so, never a dead Join. */
export const Unavailable: Story = {
  args: { status: 'unavailable', space: null, title: 'Space' },
};

/** The server answered and there is no such space. */
export const Missing: Story = {
  args: { status: 'missing', space: null, title: 'Space' },
};

/** Long titles and names truncate on the card and in the breadcrumb. */
export const LongContent: Story = {
  args: { title: LONG_SPACE.title, space: LONG_SPACE },
};

/** Pressing Join runs the join and shows its progress in place. */
export const Join: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId(Handles.spaceJoin));
    await expect(args.onJoin).toHaveBeenCalled();
  },
};
