import { groupRosterByParticipant } from '@pkgs/collab-root-shared-ts/group-roster';
import { createMemo } from 'solid-js';
import type { SpacePresenceFace } from './space-presence-strip-view';
import { useSpaceRoomClientId } from './space-room-context';
import { useConnectedSpaceRoster } from './use-connected-space-roster';
import { useSpaceParticipantColors } from './use-space-participant-colors';
import { useSpacePeople } from './use-space-people';

/** One per participant: a member connected from two tabs is one person. */
function useSpaceParticipants() {
  const roster = useConnectedSpaceRoster();
  const selfClientId = useSpaceRoomClientId();
  return createMemo(() =>
    groupRosterByParticipant(roster(), selfClientId()).flatMap((participant) =>
      participant.clients.slice(0, 1)
    )
  );
}

/**
 * One face per person connected to the space room this device holds, with
 * their profile and participant color: what the people row and the games
 * list's "In this space" line both show.
 */
export function useSpacePresenceFaces(
  spaceId: () => string
): () => readonly SpacePresenceFace[] {
  const colors = useSpaceParticipantColors(spaceId);
  const clients = useSpaceParticipants();
  const people = useSpacePeople(() => clients().map((client) => client.id));
  return createMemo((): readonly SpacePresenceFace[] =>
    clients().map((actor) => ({
      actor,
      person: people().find((person) => person.id === actor.id) ?? null,
      color: colors.colorForParticipant(actor.id),
    }))
  );
}
