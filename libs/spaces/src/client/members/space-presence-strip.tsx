/**
 * Connected-client presence strip for space chrome (one face per client).
 */

import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { groupRosterByParticipant } from '@pkgs/collab';
import { PresenceStrip } from '@pkgs/collab-ui';
import { useRoomFromRegistry, useRoomRoster } from '@pkgs/room';
import { type ReactNode, useMemo } from 'react';

import { useSpaceRoomClientId } from '../room/space-room-context';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';
import { SPACE_ROOM_NAME } from '../room/use-space-room-selector';

export type SpacePresenceStripProps = {
  spaceId: string;
  size: number;
  /**
   * Optional standalone press handler. Omit when embedded in an ActionBar /
   * IconButton that already owns the press target (nested buttons are invalid).
   */
  onPress?: () => void;
};

export function SpacePresenceStrip({
  spaceId,
  size,
  onPress,
}: SpacePresenceStripProps): ReactNode {
  const room = useRoomFromRegistry(SPACE_ROOM_NAME);
  const roster = useRoomRoster(room);
  const selfClientId = useSpaceRoomClientId();
  const { colorForParticipant } = useSpaceParticipantColors(spaceId);

  // Expand grouped participants back to a flat per-client list so the strip
  // shows one face per connected client (same avatar repeated when needed).
  const clients = useMemo(() => {
    const grouped = groupRosterByParticipant(roster, selfClientId);
    return grouped.flatMap((p) => p.clients);
  }, [roster, selfClientId]);

  return (
    <PresenceStrip
      clients={clients}
      colorForParticipant={(id) => colorForParticipant(id)}
      renderAvatar={(actor, avatarSize) => (
        <UserProfileAvatar profileId={actor.id} size={avatarSize} />
      )}
      size={size}
      maxVisible={4}
      {...(onPress !== undefined ? { onPress } : {})}
    />
  );
}
