/**
 * Connected-member presence strip for space chrome (one face per member).
 * Before anyone else's presence arrives it shows the people glyph, so the
 * members button is never an empty disc.
 */

import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { groupRosterByParticipant } from '@pkgs/collab-root-shared/group-roster';
import { PresenceStrip } from '@pkgs/collab-ui-client/presence-strip';
import { UsersIcon } from '@pkgs/ui-root-client/icons';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';

import { useSpaceRoomClientId } from './space-room-context';
import { useConnectedSpaceRoster } from './use-connected-space-roster';
import { useSpaceParticipantColors } from './use-space-participant-colors';

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
  const roster = useConnectedSpaceRoster();
  const colors = useSpaceParticipantColors(props.spaceId);
  const selfClientId = useSpaceRoomClientId();

  // One face per participant: a member connected from two tabs is one person.
  const clients = createMemo(() =>
    groupRosterByParticipant(roster(), selfClientId()).flatMap((participant) =>
      participant.clients.slice(0, 1)
    )
  );

  return (
    <Show
      when={clients().length > 0}
      fallback={<UsersIcon size={Math.round(props.size * 0.6)} color="icon" />}
    >
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
    </Show>
  );
}
