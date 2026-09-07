/**
 * Connected-client presence strip for space chrome (one face per client).
 */

import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { groupRosterByParticipant } from '@pkgs/collab';
import { PresenceStrip } from '@pkgs/collab-ui';
import { useNamedRoomRoster } from '@pkgs/room/solid';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';

import { useSpaceRoomClientId } from '../../../public/room/space-room-context';
import { SPACE_ROOM_NAME } from '../../../public/room/use-space-room-selector';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';

export type SpacePresenceStripProps = {
  spaceId: string;
  size: number;
  /**
   * Optional standalone press handler. Omit when embedded in an ActionBar /
   * IconButton that already owns the press target (nested buttons are invalid).
   */
  onPress?: () => void;
};

export function SpacePresenceStrip(
  props: SpacePresenceStripProps
): JSX.Element {
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const colors = useSpaceParticipantColors(props.spaceId);
  const selfClientId = useSpaceRoomClientId();

  // Expand grouped participants back to a flat per-client list so the strip
  // shows one face per connected client (same avatar repeated when needed).
  const clients = createMemo(() =>
    groupRosterByParticipant(roster(), selfClientId()).flatMap((p) => p.clients)
  );

  return (
    <PresenceStrip
      clients={clients()}
      colorForParticipant={(id) => colors.colorForParticipant(id)}
      renderAvatar={(actor, avatarSize) => (
        <UserProfileAvatar profileId={actor.id} size={avatarSize} />
      )}
      size={props.size}
      maxVisible={4}
      {...(props.onPress !== undefined ? { onPress: props.onPress } : {})}
    />
  );
}
