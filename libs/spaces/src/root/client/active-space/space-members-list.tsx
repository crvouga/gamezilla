import { useMyId } from '@libs/auth/public/use-current-user';
import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { Trans } from '@lingui/solid/macro';
import { Box, CONTENT_EDGE_PADDING_STEP, Text } from '@pkgs/ui';
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
    <Box sx={{ gap: 0 }}>
      <Show when={host()} keyed>
        {(current) => (
          <SpaceMembersSeatRow
            profileId={current.profileId}
            memberId={current.deviceId}
            deviceLabel={current.deviceLabel}
            trailing={
              <Text
                variant="caption"
                sx={{ color: 'textSecondary' }}
                label={<Trans>Host</Trans>}
              />
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
    </Box>
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
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
        px: CONTENT_EDGE_PADDING_STEP,
      }}
    >
      <UserProfileAvatar profileId={props.profileId} size={ROW_AVATAR_SIZE} />
      <Box sx={{ flex: 1, minWidth: 0, gap: 0 }}>
        <UserUsername
          profileId={props.profileId}
          withAt={false}
          variant="body"
          numberOfLines={1}
        />
        <Show when={props.deviceLabel !== null && props.deviceLabel.length > 0}>
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            numberOfLines={1}
            label={props.deviceLabel ?? ''}
          />
        </Show>
      </Box>
      <Show when={props.memberId === myId()}>
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>You</Trans>}
        />
      </Show>
      {props.trailing}
    </Box>
  );
}
