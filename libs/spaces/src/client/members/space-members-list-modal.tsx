import { useMyId } from '@libs/auth/client/use-current-user';
import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { UserUsername } from '@libs/profile/client/user-username';
import { Trans, useLingui } from '@lingui/react/macro';
import { groupRosterByParticipant } from '@pkgs/collab';
import { PresenceRosterList, type PresenceRosterRow } from '@pkgs/collab-ui';
import { asLocalized } from '@pkgs/i18n';
import { useRoomFromRegistry, useRoomRoster } from '@pkgs/room';
import { Badge, ResponsiveSurface, ScrollView, Stack } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';
import { useSpaceRoomClientId } from '../room/space-room-context';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';
import { SPACE_ROOM_NAME } from '../room/use-space-room-selector';
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
export function SpaceMembersListModal({
  spaceId,
  visible,
  onClose,
}: SpaceMembersListModalProps): ReactNode {
  const { t } = useLingui();
  const myId = useMyId();
  const selfClientId = useSpaceRoomClientId();
  const room = useRoomFromRegistry(SPACE_ROOM_NAME);
  const roster = useRoomRoster(room);
  const { colorForParticipant } = useSpaceParticipantColors(spaceId);

  const rows: readonly PresenceRosterRow[] = useMemo(() => {
    const grouped = groupRosterByParticipant(roster, selfClientId);
    const out: PresenceRosterRow[] = [];
    for (const participant of grouped) {
      for (const client of participant.clients) {
        out.push({
          client,
          title: asLocalized(client.id),
          isYou: participant.isYou,
          isThisTab: client.clientId === selfClientId,
          badges: (
            <SpaceMemberBadges
              spaceId={spaceId}
              memberId={client.id}
              myId={myId}
              isThisTab={client.clientId === selfClientId}
            />
          ),
        });
      }
    }
    return out;
  }, [roster, selfClientId, spaceId, myId]);

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>People in this space</Trans>}
    >
      <ScrollView style={{ maxHeight: 420 }} sx={{ px: 0 }}>
        {rows.length === 0 ? (
          <Trans>No one connected yet</Trans>
        ) : (
          <PresenceRosterList
            rows={rows.map((row) => ({
              ...row,
              title: asLocalized(
                // Username component can't be a LocalizedString; show id and
                // overlay a username via trailing badges / subtitle later.
                row.client.id === myId ? t`You` : row.client.id
              ),
            }))}
            colorForParticipant={(id) => colorForParticipant(id)}
            renderAvatar={(actor, size) => (
              <UserProfileAvatar profileId={actor.id} size={size} />
            )}
          />
        )}
      </ScrollView>
    </ResponsiveSurface>
  );
}

function SpaceMemberBadges({
  spaceId,
  memberId,
  myId,
  isThisTab,
}: {
  spaceId: string;
  memberId: string;
  myId: string;
  isThisTab: boolean;
}): ReactNode {
  const role = useMemberRole(spaceId, memberId);
  return (
    <Stack direction="horizontal" spacing={1} align="center">
      {role === 'host' ? (
        <Badge
          label={<Trans>Host</Trans>}
          intent="brand"
          tone="subtle"
          size="sm"
        />
      ) : null}
      {memberId === myId ? (
        <Badge
          label={<Trans>You</Trans>}
          intent="info"
          tone="subtle"
          size="sm"
        />
      ) : null}
      {isThisTab ? (
        <Badge
          label={<Trans>This tab</Trans>}
          intent="success"
          tone="subtle"
          size="sm"
        />
      ) : null}
      <UserUsername profileId={memberId} />
    </Stack>
  );
}
