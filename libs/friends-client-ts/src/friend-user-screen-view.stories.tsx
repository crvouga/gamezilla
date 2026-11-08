import { RefusedChangeCard } from '@libs/app-env-client-ts/refused-change-notice';
import type { FriendProfile } from '@libs/friends-shared-ts/friends-types';
import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
import { serializeDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FriendUserScreenView } from './friend-user-screen-view';
import { FriendUserSuccessExample } from './friend-user-success.example';

/** Morgan's id in the space fixtures (`spaces-story.example.tsx`): one face everywhere. */
const MORGAN_ID = '5a1e0000-0000-4000-8000-000000000003';

const PROFILE: FriendProfile = {
  userId: MORGAN_ID,
  username: 'morgan',
  avatarConfig: serializeDefaultAvatarConfig(MORGAN_ID),
};

const resolved = () => fn(() => Promise.resolve());

const meta = {
  id: 'screens-friends-user',
  title: 'Screens/Friends/Friend profile',
  component: FriendUserScreenView,
  tags: ['autodocs'],
  decorators: [withShippedModeration],
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['profile', 'requestOutcome', 'actions', 'denial', 'notice'],
    },
  },
  args: {
    presence: 'shown',
    profile: PROFILE,
    status: 'none',
    requestOutcome: null,
    actions: {
      addFriend: resolved(),
      confirmRequest: resolved(),
      deleteRequest: resolved(),
      cancelRequest: resolved(),
      unblock: resolved(),
    },
    addFailureCode: null,
    confirming: null,
    onRetry: fn(),
    onChanged: fn(),
    onRequestRemove: fn(),
    onRequestBlock: fn(),
    onCancelConfirm: fn(),
    onRemove: resolved(),
    onBlock: resolved(),
  },
} satisfies Meta<typeof FriendUserScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A stranger: their face and name, and Add friend. Block is in the menu. */
export const Stranger: Story = {};

/** The person's row has not arrived yet: placeholders hold the identity's place. */
export const Loading: Story = { args: { presence: 'loading' } };

/** This device has never synced and the last attempt failed; retry asks again. */
export const Unreachable: Story = { args: { presence: 'unreachable' } };

/** The requested profile does not exist after its scope has answered. */
export const Unavailable: Story = { args: { presence: 'unavailable' } };

/** A synced tombstone explains why this profile cannot be opened. */
export const Deleted: Story = {
  args: {
    presence: 'deleted',
    profile: { userId: MORGAN_ID, username: '', avatarConfig: null },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('This account was deleted.')).toBeVisible();
    await expect(
      canvas.queryByText(/morgan|5a1e0000/i)
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'Account deleted', level: 1 })
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Return to Friends' })
    ).toHaveAttribute('href', '/profile/friends');
    await expect(
      canvas.queryByRole('button', { name: 'Add friend' })
    ).not.toBeInTheDocument();
  },
};

/** A request is out: one Cancel request control. */
export const RequestSent: Story = { args: { status: 'pending_outgoing' } };

/** The request is still being shared with the server. */
export const RequestSharing: Story = {
  args: {
    status: 'pending_outgoing',
    requestOutcome: { status: 'pending', online: true },
  },
};

/** Offline, the request waits for the connection to return. */
export const RequestWaitingForConnection: Story = {
  args: {
    status: 'pending_outgoing',
    requestOutcome: { status: 'pending', online: false },
  },
};

/** The server refused the request and says why. */
export const RequestRefused: Story = {
  args: { requestOutcome: { status: 'rejected', code: 'FRIENDS_COOLDOWN' } },
};

/** They asked first: Accept or Decline their request. */
export const RequestReceived: Story = { args: { status: 'pending_incoming' } };

/** Already friends: the status pill, with Remove friend in the menu. */
export const Friends: Story = { args: { status: 'friends' } };

/** Blocked by me: Unblock is the only action left. */
export const BlockedByMe: Story = { args: { status: 'blocked_by_me' } };

/** They blocked me: nothing can be done here. */
export const BlockedByThem: Story = { args: { status: 'blocked_by_them' } };

/** Removing a friend asks first. */
export const ConfirmRemove: Story = {
  args: { status: 'friends', confirming: 'remove' },
};

/** Blocking asks first, and says what it stops. */
export const ConfirmBlock: Story = { args: { confirming: 'block' } };

/** A refused friend change (an unblock, say) is told under the identity. */
export const RefusedChange: Story = {
  render: (args) => (
    <FriendUserScreenView
      {...args}
      notice={
        <RefusedChangeCard
          refusal={{
            mutationId: '3b9f0c2e-0000-4000-8000-000000000003',
            mutationName: 'unblockUser',
            code: 'FORBIDDEN',
            message: 'Forbidden',
            meta: null,
          }}
          onDismiss={() => undefined}
        />
      }
    />
  ),
  args: {
    status: 'blocked_by_me',
  },
};

/** A valid maximum-length identity must remain readable on a phone. */
// regression: friend-profile-valid-username-clipped
export const LongName: Story = {
  args: {
    profile: {
      ...PROFILE,
      username: 'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    },
  },
  play: async ({ canvasElement }) => {
    const heading = await within(canvasElement).findByTestId(
      Handles.friendUserUsername
    );
    await canvasElement.ownerDocument.fonts.ready;
    await expect(heading.scrollWidth).toBeLessThanOrEqual(heading.clientWidth);
    await expect(heading.scrollHeight).toBeLessThanOrEqual(
      heading.clientHeight
    );
  },
};

/** Their username is no longer allowed: the profile shows their stable stand-in name. */
export const MaskedName: Story = {
  args: { profile: { ...PROFILE, username: 'support_staff' } },
};

/** An anonymous person sees the sign-in way forward instead of the profile. */
export const Denied: Story = {
  args: {
    denial: {
      icon: UsersIcon,
      title: 'Sign in to add friends',
      body: 'Friends let you find each other and jump into shared spaces.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: { testid: 'permission-denial', reason: 'requires_account' },
    },
  },
};

/** A failed remove keeps the confirmation open with a retryable error. */
export const RemoveFailed: Story = {
  args: {
    status: 'friends',
    confirming: 'remove',
    onRemove: fn(() => Promise.reject(new Error('offline'))),
  },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByTestId(Handles.friendRemoveConfirm('morgan'))
    );
    await expect(
      await body.findByText('This friend could not be removed. Try again.')
    ).toBeVisible();
    await expect(args.onRemove).toHaveBeenCalledOnce();
  },
};

/** Removal is acknowledged in place until the person chooses Done. */
export const RemoveSucceeded: Story = {
  render: (args) => <FriendUserSuccessExample {...args} />,
  args: { status: 'friends', confirming: 'remove', onRemove: resolved() },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByTestId(Handles.friendRemoveConfirm('morgan'))
    );
    await expect(await body.findByText('Friend removed')).toBeVisible();
    await expect(args.onRemove).toHaveBeenCalledOnce();
    await expect(args.onCancelConfirm).not.toHaveBeenCalled();
  },
};

/** Blocking is acknowledged in place, preserving the route to unblock later. */
export const BlockSucceeded: Story = {
  render: (args) => <FriendUserSuccessExample {...args} />,
  args: { confirming: 'block', onBlock: resolved() },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByTestId(Handles.friendBlockConfirm('morgan'))
    );
    await expect(await body.findByText('User blocked')).toBeVisible();
    await expect(args.onBlock).toHaveBeenCalledOnce();
    await expect(args.onCancelConfirm).not.toHaveBeenCalled();
  },
};

/** A failed block offers a retry without leaving the person's profile. */
export const BlockFailed: Story = {
  args: {
    confirming: 'block',
    onBlock: fn(() => Promise.reject(new Error('offline'))),
  },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByTestId(Handles.friendBlockConfirm('morgan'))
    );
    await expect(
      await body.findByText('This user could not be blocked. Try again.')
    ).toBeVisible();
    await expect(
      await body.findByRole('button', { name: 'Try again' })
    ).toBeEnabled();
    await expect(args.onBlock).toHaveBeenCalledOnce();
  },
};

/** After acknowledging removal, the same profile offers Add friend. */
export const RemoveDismissed: Story = {
  ...RemoveSucceeded,
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByTestId(Handles.friendRemoveConfirm('morgan'))
    );
    await userEvent.click(
      await body.findByTestId(Handles.friendRemoveDone('morgan'))
    );
    await expect(
      body.queryByTestId(Handles.friendRemoveSuccess('morgan'))
    ).not.toBeInTheDocument();
    await expect(
      await body.findByTestId(Handles.friendAdd('morgan'))
    ).toBeVisible();
    await expect(
      await body.findByTestId(Handles.friendUserUsername)
    ).toHaveTextContent('@morgan');
    await expect(args.onCancelConfirm).toHaveBeenCalledOnce();
  },
};

/** After acknowledging a block, the same profile offers Unblock. */
export const BlockDismissed: Story = {
  ...BlockSucceeded,
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByTestId(Handles.friendBlockConfirm('morgan'))
    );
    await userEvent.click(
      await body.findByTestId(Handles.friendBlockDone('morgan'))
    );
    await expect(
      body.queryByTestId(Handles.friendBlockSuccess('morgan'))
    ).not.toBeInTheDocument();
    await expect(
      await body.findByTestId(Handles.friendUnblock('morgan'))
    ).toBeVisible();
    await expect(
      await body.findByTestId(Handles.friendUserUsername)
    ).toHaveTextContent('@morgan');
    await expect(args.onCancelConfirm).toHaveBeenCalledOnce();
  },
};
