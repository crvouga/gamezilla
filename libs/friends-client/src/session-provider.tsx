/** @jsxImportSource solid-js */
/**
 * Friends' session tree: the friend-request notification source, the
 * decision-modal state, and the friend bits that fill profile's and search's
 * slots.
 *
 * Loaded with the sync engine — the notification provider and the profile
 * widgets both read synced rows and run mutations.
 */

import { NotificationSourceProvider } from '@libs/notifications-client/notification-sources';
import { useCan } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { ProfileScreenSlotsProvider } from '@libs/profile-client/profile-screen-slots';
import { SearchResultSlotsProvider } from '@libs/search-client/search-result-slots';
import type { UserSearchResult } from '@libs/user-search-shared/user-search-types';
import { createMemo, type JSX } from 'solid-js';

import { FriendRequestDecisionProvider } from './friend-request-decision-state';
import { createFriendsNotificationProvider } from './friends-notification-provider';
import { ProfileFriendsActions } from './profile-friends-actions-view';
import { ProfileFriendsStats } from './profile-friends-stats-view';
import { SearchFriendResultRow } from './search-friend-result-row';
import { useFriendsClientDeps } from './use-friends-client-deps';

const PROFILE_SLOTS = {
  stats: () => <ProfileFriendsStats />,
  actions: () => <ProfileFriendsActions />,
};

const SEARCH_SLOTS = {
  userRow: (user: UserSearchResult) => <SearchFriendResultRow user={user} />,
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
          <SearchResultSlotsProvider value={SEARCH_SLOTS}>
            {props.children}
          </SearchResultSlotsProvider>
        </ProfileScreenSlotsProvider>
      </FriendRequestDecisionProvider>
    </NotificationSourceProvider>
  );
}
