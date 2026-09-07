import { useMyId } from '@libs/auth/public/use-current-user';
import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { Trans, useLingui } from '@lingui/solid/macro';
import { groupRosterByParticipant } from '@pkgs/collab';
import { PresenceRosterList, type PresenceRosterRow } from '@pkgs/collab-ui';
import { asLocalized } from '@pkgs/i18n';
import { useNamedRoomRoster } from '@pkgs/room/solid';
import { Badge, ResponsiveSurface, ScrollView, Stack } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { useSpaceRoomClientId } from '../../../public/room/space-room-context';
import { SPACE_ROOM_NAME } from '../../../public/room/use-space-room-selector';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';
import { useMemberRole } from './use-member-role';

export type SpaceMembersListModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Modal listing connected clients (one row per client). Uses
 * {@link ResponsiveSurface} (bottom sheet on mobile, centered modal on wider
 * viewports).
 */
export function SpaceMembersListModal(
  props: SpaceMembersListModalProps
): JSX.Element {
  const { t } = useLingui();
  const myId = useMyId();
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const colors = useSpaceParticipantColors(props.spaceId);
  const selfClientId = useSpaceRoomClientId();

  const rows = createMemo<readonly PresenceRosterRow[]>(() => {
    const grouped = groupRosterByParticipant(roster(), selfClientId());
    const out: PresenceRosterRow[] = [];
    for (const participant of grouped) {
      for (const client of participant.clients) {
        out.push({
          client,
          title: asLocalized(client.id),
          isYou: participant.isYou,
          isThisTab: client.clientId === selfClientId(),
          badges: (
            <SpaceMemberBadges
              spaceId={props.spaceId}
              memberId={client.id}
              myId={myId()}
              isThisTab={client.clientId === selfClientId()}
            />
          ),
        });
      }
    }
    return out;
  });

  const titledRows = createMemo<readonly PresenceRosterRow[]>(() =>
    rows().map((row) => ({
      ...row,
      title: asLocalized(row.client.id === myId() ? t`You` : row.client.id),
    }))
  );

  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={<Trans>People in this space</Trans>}
    >
      <ScrollView frameSx={{ maxHeight: 420 }} sx={{ px: 0 }}>
        <Show
          when={titledRows().length > 0}
          fallback={<Trans>No one connected yet</Trans>}
        >
          <PresenceRosterList
            rows={titledRows()}
            colorForParticipant={(id) => colors.colorForParticipant(id)}
            renderAvatar={(actor, size) => (
              <UserProfileAvatar profileId={actor.id} size={size} />
            )}
          />
        </Show>
      </ScrollView>
    </ResponsiveSurface>
  );
}

function SpaceMemberBadges(props: {
  spaceId: string;
  memberId: string;
  myId: string;
  isThisTab: boolean;
}): JSX.Element {
  const role = useMemberRole(props.spaceId, props.memberId);
  return (
    <Stack direction="horizontal" spacing={1} align="center">
      <Show when={role() === 'host'}>
        <Badge
          label={<Trans>Host</Trans>}
          intent="brand"
          tone="subtle"
          size="sm"
        />
      </Show>
      <Show when={props.memberId === props.myId}>
        <Badge
          label={<Trans>You</Trans>}
          intent="info"
          tone="subtle"
          size="sm"
        />
      </Show>
      <Show when={props.isThisTab}>
        <Badge
          label={<Trans>This tab</Trans>}
          intent="success"
          tone="subtle"
          size="sm"
        />
      </Show>
      <UserUsername profileId={props.memberId} />
    </Stack>
  );
}
