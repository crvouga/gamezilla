/** @jsxImportSource solid-js */
/**
 * Friends' session tree: the friend-request notification source, the
 * decision-modal state, and the friend bits that fill profile's slots.
 *
 * Loaded with the sync engine — the notification provider and the profile
 * widgets both read synced rows and run mutations.
 */

import { NotificationSourceProvider } from '@libs/notifications/public/notification-sources';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useCan } from '@libs/permissions/public/use-can';
import { ProfileScreenSlotsProvider } from '@libs/profile/public/profile-screen-slots';
import { createMemo, type JSX } from 'solid-js';

import { FriendRequestDecisionProvider } from '../../../public/friend-request-decision-state';
import { createFriendsNotificationProvider } from '../friends-notification-provider';
import { ProfileFriendsActions } from '../profile-friends-actions';
import { ProfileFriendsStats } from '../profile-friends-stats';
import { useFriendsClientDeps } from '../use-friends-client-deps';

const PROFILE_SLOTS = {
  stats: () => <ProfileFriendsStats />,
  actions: () => <ProfileFriendsActions />,
};

export default function FriendsSession(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const deps = useFriendsClientDeps();
  const canReceive = useCan(PERMISSION.notificationsReceive);
  const sources = createMemo(() =>
    canReceive() ? [createFriendsNotificationProvider(deps)] : []
  );
  return (
    <NotificationSourceProvider sources={sources}>
      {/* Decision-modal open state lives above the virtualized notification
          rows so row recycling (read-state flips, sync merges) cannot close
          it. */}
      <FriendRequestDecisionProvider>
        <ProfileScreenSlotsProvider value={PROFILE_SLOTS}>
          {props.children}
        </ProfileScreenSlotsProvider>
      </FriendRequestDecisionProvider>
    </NotificationSourceProvider>
  );
}
