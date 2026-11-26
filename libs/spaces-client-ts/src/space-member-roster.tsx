import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, mapArray } from 'solid-js';
import type { SpaceMemberRow } from './space-member-roster-view';
import { SpaceMemberRosterView } from './space-member-roster-view';
import type { SpacePerson } from './space-person-view';
import { useSpaceRoomClientId } from './space-room-context';
import { useMemberRole } from './use-member-role';
import { useOpenSpacePresence } from './use-open-space-presence';
import { useSpaceCan } from './use-space-can';
import { useClearSpaceQuiet } from './use-space-device-quiet';
import { useSpaceParticipantColors } from './use-space-participant-colors';
import { useSpacePerson } from './use-space-people';

export type SpaceMemberRosterProps = {
  spaceId: string;
  visible: boolean;
  /** Opens Share, from the empty list's invitation. */
  onShare?: (() => void) | undefined;
  /** Starts removing a guest; offered only to someone who may. */
  onRemove?: ((person: SpacePerson) => void) | undefined;
};

/**
 * Wires {@link SpaceMemberRosterView} to the room this device holds: who is
 * connected, who is idle, who hosts. Opening it clears the quiet marker.
 */
export function SpaceMemberRoster(props: SpaceMemberRosterProps): JSX.Element {
  const myId = useMyId();
  const presence = useOpenSpacePresence(() => props.spaceId);
  const colors = useSpaceParticipantColors(() => props.spaceId);
  const selfClientId = useSpaceRoomClientId();
  const clearQuiet = useClearSpaceQuiet();
  const canManage = useSpaceCan(
    () => props.spaceId,
    PERMISSION.spacesManageMembers
  );
  createEffect(
    () => props.visible,
    (visible) => {
      if (visible) clearQuiet();
    }
  );

  const members = mapArray(presence.people, (person) => {
    const role = useMemberRole(() => props.spaceId, person.id);
    const shown = useSpacePerson(() => person.id);
    return createMemo(
      (): SpaceMemberRow => ({
        actor: { id: person.id, clientId: person.clientId },
        person: shown(),
        color: colors.colorForParticipant(person.id),
        isYou: person.id === myId(),
        isThisTab: person.clientId === selfClientId(),
        idle: presence.idle().has(person.id),
        isHost: role() === 'host',
      })
    );
  });

  return (
    <SpaceMemberRosterView
      onShare={props.onShare}
      onRemove={canManage() ? props.onRemove : undefined}
      members={members().map((member) => member())}
    />
  );
}
