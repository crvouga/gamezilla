import type { FriendActionMutations } from '@libs/friends-shared-ts/friend-action-types';
import type {
  FriendProfile,
  FriendshipStatus,
} from '@libs/friends-shared-ts/friends-types';
import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ProfileScreenLayout } from '@pkgs/ui-root-client-ts/profile-screen-layout';
import type { ScreenBaseAction } from '@pkgs/ui-root-client-ts/screen-base-types';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import type { FriendRequestOutcome } from './friend-request-feedback-view';
import { FriendUserDangerModals } from './friend-user-danger-modals';
import type { FriendUserPresence } from './friend-user-screen-content';
import {
  FriendUserIdentity,
  FriendUserIdentityActions,
} from './friend-user-screen-content';
import { useFriendUserOverflowMenu } from './use-friend-user-overflow-menu';
import { friendUserBreadcrumbName } from './use-friend-user-profile';

/** Which confirm-first danger action is asking, if any. */
export type FriendUserConfirming = 'remove' | 'block' | null;

export type FriendUserScreenViewProps = {
  readonly presence: FriendUserPresence;
  /** The person as this device knows them (username empty until synced). */
  readonly profile: FriendProfile;
  readonly status: FriendshipStatus;
  /** The last friend request to them, while shared or after it was refused. */
  readonly requestOutcome: FriendRequestOutcome | null;
  /** The friend pills' mutations, bound to this person. */
  readonly actions: FriendActionMutations;
  /** Why the last Add was refused, so the pill can say so. */
  readonly addFailureCode: string | null;
  readonly confirming: FriendUserConfirming;
  /** Set when the person may not use friends; replaces the whole profile. */
  readonly denial?: DenialView | undefined;
  /** Inline notice for a refused friend change, under the identity. */
  readonly notice?: JSX.Element;
  readonly onRetry: () => void;
  /** A pill's mutation succeeded: refresh what the profile shows. */
  readonly onChanged: () => void;
  readonly onRequestRemove: () => void;
  readonly onRequestBlock: () => void;
  readonly onCancelConfirm: () => void;
  /** Removes the friend and leaves; rejects to keep the confirm open. */
  readonly onRemove: () => Promise<void>;
  /** Blocks the person and leaves; rejects to keep the confirm open. */
  readonly onBlock: () => Promise<void>;
};

/** Remove friend / Block, in the header overflow, once the profile is shown. */
function useHeaderActions(props: FriendUserScreenViewProps) {
  const menuActions = useFriendUserOverflowMenu(
    () => props.status,
    () => props.onRequestRemove(),
    () => props.onRequestBlock(),
    () => props.profile.username
  );
  return createMemo((): ScreenBaseAction[] => {
    if (props.presence !== 'shown') return [];
    return menuActions().map((action) => ({
      type: 'default' as const,
      label: action.label,
      onClick: action.onPress,
      overflow: 'always' as const,
      ...(action.endsGroup === true ? { endsGroup: true } : {}),
      dataSet: action.dataSet,
    }));
  });
}

function FriendUserProfileView(props: FriendUserScreenViewProps): JSX.Element {
  const moderation = useModeration();
  const headerActions = useHeaderActions(props);
  const breadcrumbs = createMemo(() => [
    { name: <Trans>Profile</Trans>, href: '/profile' },
    {
      name: friendUserBreadcrumbName(
        moderation(),
        props.profile,
        props.profile.userId
      ),
    },
  ]);
  return (
    <ProfileScreenLayout
      screenId="friend-user"
      breadcrumbs={breadcrumbs()}
      actions={headerActions()}
      identity={
        <FriendUserIdentity
          presence={props.presence}
          profile={props.profile}
          requestOutcome={props.requestOutcome}
          notice={props.notice}
          onRetry={() => props.onRetry()}
        />
      }
      identityActions={
        <Show when={props.presence === 'shown'}>
          <FriendUserIdentityActions
            profile={props.profile}
            status={props.status}
            mutations={props.actions}
            addFailureCode={props.addFailureCode}
            onChanged={() => props.onChanged()}
          />
        </Show>
      }
    >
      <Show when={props.presence === 'shown'}>
        <FriendUserDangerModals
          username={props.profile.username}
          removeOpen={props.confirming === 'remove'}
          blockOpen={props.confirming === 'block'}
          onCloseRemove={() => props.onCancelConfirm()}
          onCloseBlock={() => props.onCancelConfirm()}
          onRemove={() => props.onRemove()}
          onBlock={() => props.onBlock()}
        />
      </Show>
    </ProfileScreenLayout>
  );
}

/**
 * `/profile/user/:userId`, presentational: another person's profile with
 * their friendship status pills, request outcome, Remove / Block confirms,
 * and its loading, unreachable, withdrawn and permission-denied states.
 * `FriendUserScreen` wires it to the sync engine and the friend mutations.
 */
export function FriendUserScreenView(
  props: FriendUserScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<FriendUserProfileView {...props} />}>
      {(denial) => (
        <ContentScreen
          screenId="friends-permission-gate"
          breadcrumbs={[
            { name: <Trans>Profile</Trans>, href: '/profile' },
            { name: <Trans>Friends</Trans> },
          ]}
        >
          <DenialSurfaceView denial={denial()} />
        </ContentScreen>
      )}
    </Show>
  );
}
