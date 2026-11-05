import { RefusedChangeCard } from '@libs/app-env-client-ts/refused-change-notice';
import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
import { moderationAlias } from '@libs/moderation-shared-ts/alias';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ProfileScreenView } from './profile-screen-view';
import {
  STORY_FRIEND_COUNT,
  STORY_IDENTITY,
  StoryFriendsActions,
  StoryFriendsPlaying,
  StoryFriendsStats,
} from './profile-story.example';

const meta = {
  id: 'screens-profile-tab',
  title: 'Screens/Profile/Profile',
  component: ProfileScreenView,
  tags: ['autodocs'],
  decorators: [withShippedModeration],
  parameters: {
    appRouter: true,
    controls: {
      exclude: [
        'identity',
        'usernameChange',
        'notice',
        'friendsStats',
        'friendsActions',
        'friendsPlaying',
      ],
    },
  },
  args: {
    status: 'ready',
    identity: STORY_IDENTITY,
    standInName: null,
    usernameChange: null,
    onEditProfile: fn(),
    onOpenSettings: fn(),
    onChooseUsername: fn(),
    onRetry: fn(),
  },
  // Slot content is JSX, so it is built at render time (inside the story's
  // providers), never in module-level args.
  render: (args) => (
    <ProfileScreenView
      {...args}
      friendsPlaying={<StoryFriendsPlaying />}
      friendsStats={<StoryFriendsStats count={STORY_FRIEND_COUNT} />}
      friendsActions={<StoryFriendsActions />}
    />
  ),
} satisfies Meta<typeof ProfileScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The person's own profile: avatar, name, Edit profile, the rooms friends
 * are playing in now (each by its tile, who is there, and one Join), the
 * friends row with their faces, and the way to Settings. On a wide screen
 * the identity is a band across the top, the rooms the main column, and
 * Friends and Settings the rail beside it.
 */
export const Ready: Story = {};

/**
 * The username is no longer allowed: others see a stable stand-in name until
 * the person chooses a new username, and the profile says so.
 */
export const StandInName: Story = {
  args: {
    identity: { ...STORY_IDENTITY, username: 'support_staff' },
    standInName: moderationAlias(STORY_IDENTITY.profileId),
  },
};

/** The profile row has not been read yet: a placeholder holds the name's place. */
export const Loading: Story = { args: { status: 'loading', identity: null } };

/** The first sync failed with nothing cached; retry asks for the data again. */
export const Failed: Story = {
  args: {
    status: 'failed',
    identity: { ...STORY_IDENTITY, username: null, avatarConfig: null },
  },
};

/** A profile composed without the friends sub has no friends row: a real state. */
export const WithoutFriendsSlots: Story = {
  render: (args) => <ProfileScreenView {...args} />,
};

/** A synthetic account's name carries the server-controlled Bot badge. */
export const Bot: Story = {
  args: {
    identity: { ...STORY_IDENTITY, username: 'helper_bot', isBot: true },
  },
};

/** A username change is still being shared with the server. */
export const UsernameChangeSharing: Story = {
  args: { usernameChange: { status: 'pending', online: true } },
};

/** Offline, the username change waits for the connection to return. */
export const UsernameChangeOffline: Story = {
  args: { usernameChange: { status: 'pending', online: false } },
};

/** The server refused the username change; the person can choose another. */
export const UsernameChangeRefused: Story = {
  args: { usernameChange: { status: 'rejected', code: 'USERNAME_TAKEN' } },
};

/** An avatar change that showed at once and was then refused is told here. */
export const RefusedAvatarChange: Story = {
  render: (args) => (
    <ProfileScreenView
      {...args}
      notice={
        <RefusedChangeCard
          refusal={{
            mutationId: '3b9f0c2e-0000-4000-8000-000000000001',
            mutationName: 'patchAvatar',
            code: 'FORBIDDEN',
            message: 'Forbidden',
            meta: null,
          }}
          onDismiss={() => undefined}
        />
      }
      friendsPlaying={<StoryFriendsPlaying />}
      friendsStats={<StoryFriendsStats count={STORY_FRIEND_COUNT} />}
      friendsActions={<StoryFriendsActions />}
    />
  ),
};

/** Long names truncate to one line instead of widening the identity column. */
export const LongName: Story = {
  args: {
    identity: {
      ...STORY_IDENTITY,
      username: 'a_really_long_username_that_keeps_going',
    },
  },
  render: (args) => (
    <ProfileScreenView
      {...args}
      friendsStats={<StoryFriendsStats count={1284} />}
      friendsActions={<StoryFriendsActions />}
    />
  ),
};

/** Edit profile opens the editor menu; nothing else on the tab navigates. */
export const OpenEditProfile: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Edit profile'));
    await expect(args.onEditProfile).toHaveBeenCalledOnce();
  },
};
