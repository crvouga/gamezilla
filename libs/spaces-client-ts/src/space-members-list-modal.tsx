import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, mapArray, on } from 'solid-js';
import type { SpaceMemberRow } from './space-members-sheet-view';
import { SpaceMembersSheetView } from './space-members-sheet-view';
import { useSpaceRoomClientId } from './space-room-context';
import { useMemberRole } from './use-member-role';
import { useOpenSpacePresence } from './use-open-space-presence';
import { useClearSpaceQuiet } from './use-space-device-quiet';
import { useSpaceParticipantColors } from './use-space-participant-colors';
import { useSpacePerson } from './use-space-people';

export type SpaceMembersListModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Wires {@link SpaceMembersSheetView} to the room this device holds: who is
 * connected, who is idle, who hosts. Opening it clears the quiet marker.
 */
export function SpaceMembersListModal(
  props: SpaceMembersListModalProps
): JSX.Element {
  const myId = useMyId();
  const presence = useOpenSpacePresence(props.spaceId);
  const colors = useSpaceParticipantColors(props.spaceId);
  const selfClientId = useSpaceRoomClientId();
  const clearQuiet = useClearSpaceQuiet();
  createEffect(
    on(
      () => props.visible,
      (visible) => {
        if (visible) clearQuiet();
      }
    )
  );

  const members = mapArray(presence.people, (person) => {
    const role = useMemberRole(props.spaceId, person.id);
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
    <SpaceMembersSheetView
      visible={props.visible}
      onClose={props.onClose}
      members={members().map((member) => member())}
    />
  );
}
