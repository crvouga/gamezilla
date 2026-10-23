import type {
  FriendProfile,
  FriendshipStatus,
} from '@libs/friends-shared-ts/friends-types';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { UserIcon } from '@pkgs/ui-root-client-ts/icons';
import { Skeleton } from '@pkgs/ui-root-client-ts/skeleton';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { Match, Switch } from 'solid-js';
import { FriendActionPills } from './friend-action-pills';
import { FriendProfileHeader } from './friend-profile-header';
import { FriendRequestFeedback } from './friend-request-feedback';
import { FriendsRefusedChangeNotice } from './friends-refused-change-notice';

/** Where the requested profile stands on this device. */
export type FriendUserPresence =
  | 'loading'
  | 'unreachable'
  | 'unavailable'
  | 'shown';

/** The identity block of another person's profile, in every state it can be in. */
export function FriendUserIdentity(props: {
  presence: FriendUserPresence;
  profile: FriendProfile;
  outgoingRequestId: string | null;
  onRetry: () => void;
}): JSX.Element {
  return (
    <Switch
      fallback={
        <>
          <FriendProfileHeader profile={props.profile} />
          <FriendRequestFeedback
            userId={props.profile.userId}
            outgoingRequestId={props.outgoingRequestId}
          />
          <FriendsRefusedChangeNotice />
        </>
      }
    >
      <Match when={props.presence === 'loading'}>
        <Skeleton width={96} height={96} shape="circle" />
        <Skeleton width="40%" height={28} />
      </Match>
      <Match when={props.presence === 'unreachable'}>
        <ErrorState
          variant="compact"
          title={<Trans>This profile could not be loaded</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: props.onRetry }}
          dataSet={{ testid: 'friend-profile-load-error' }}
        />
      </Match>
      <Match when={props.presence === 'unavailable'}>
        <EmptyState
          variant="compact"
          icon={UserIcon}
          title={<Trans>Profile unavailable</Trans>}
          body={
            <Trans>
              This profile is no longer available because the account was
              deleted.
            </Trans>
          }
          dataSet={{ testid: 'friend-profile-unavailable' }}
        />
      </Match>
    </Switch>
  );
}

/** Add / accept / cancel / unblock, spanning the identity column. */
export function FriendUserIdentityActions(props: {
  profile: FriendProfile;
  status: FriendshipStatus;
  incomingRequestId: string | null;
  outgoingRequestId: string | null;
  onChanged: () => void;
}): JSX.Element {
  return (
    <StackVertical self="stretch">
      <FriendActionPills
        userId={props.profile.userId}
        username={props.profile.username}
        status={props.status}
        incomingRequestId={props.incomingRequestId}
        outgoingRequestId={props.outgoingRequestId}
        onChanged={props.onChanged}
      />
    </StackVertical>
  );
}
