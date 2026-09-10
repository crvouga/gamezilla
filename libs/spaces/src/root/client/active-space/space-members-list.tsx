import { useMyId } from '@libs/auth/public/use-current-user';
import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { Trans } from '@lingui/solid/macro';
import { CONTENT_EDGE_PADDING_STEP } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { useSpaceGuestMembershipIds } from '../members/use-space-guest-membership-ids';
import { useSpaceHostMembershipDisplay } from '../members/use-space-host-membership-display';

const ROW_AVATAR_SIZE = 28;

export type SpaceMembersListProps = {
  spaceId: string;
};

/**
 * Compact member list: one row per seated / ACL guest. Host first; "You" when
 * the member is this account.
 */
export function SpaceMembersList(props: SpaceMembersListProps): JSX.Element {
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  const guestIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <div class="box gap-0">
      <Show when={host()} keyed>
        {(current) => (
          <SpaceMembersSeatRow
            profileId={current.profileId}
            memberId={current.deviceId}
            deviceLabel={current.deviceLabel}
            trailing={
              <p class="text textCaption text-text-secondary">
                {<Trans>Host</Trans>}
              </p>
            }
          />
        )}
      </Show>
      <For each={guestIds()}>
        {(memberId) => (
          <SpaceMembersSeatRow
            profileId={memberId}
            memberId={memberId}
            deviceLabel={null}
          />
        )}
      </For>
    </div>
  );
}

function SpaceMembersSeatRow(props: {
  readonly profileId: string;
  readonly memberId: string;
  readonly deviceLabel: string | null;
  readonly trailing?: JSX.Element;
}): JSX.Element {
  const myId = useMyId();
  return (
    <div
      class="box flex-row items-center gap-2 py-2"
      style={{
        'padding-left': `${CONTENT_EDGE_PADDING_STEP * 4}px`,
        'padding-right': `${CONTENT_EDGE_PADDING_STEP * 4}px`,
      }}
    >
      <UserProfileAvatar profileId={props.profileId} size={ROW_AVATAR_SIZE} />
      <div class="box flex-1 min-w-[0] gap-0">
        <UserUsername
          profileId={props.profileId}
          withAt={false}
          variant="body"
          numberOfLines={1}
        />
        <Show when={props.deviceLabel !== null && props.deviceLabel.length > 0}>
          <p class="text textCaption line-clamp-1 text-text-secondary">
            {props.deviceLabel ?? ''}
          </p>
        </Show>
      </div>
      <Show when={props.memberId === myId()}>
        <p class="text textCaption text-text-secondary">{<Trans>You</Trans>}</p>
      </Show>
      {props.trailing}
    </div>
  );
}
