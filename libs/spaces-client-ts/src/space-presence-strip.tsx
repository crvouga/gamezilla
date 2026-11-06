import { groupRosterByParticipant } from '@pkgs/collab-root-shared-ts/group-roster';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import type {
  SpacePresenceFace,
  SpacePresenceStripViewProps,
} from './space-presence-strip-view';
import { SpacePresenceStripView } from './space-presence-strip-view';
import { useSpaceRoomClientId } from './space-room-context';
import { useConnectedSpaceRoster } from './use-connected-space-roster';
import { useSpaceParticipantColors } from './use-space-participant-colors';
import { useSpacePeople } from './use-space-people';

export type SpacePresenceStripProps = {
  spaceId: string;
  size: number;
  /** See {@link SpacePresenceStripViewProps.compact}. */
  compact?: boolean | undefined;
  /** See {@link SpacePresenceStripViewProps.onPress}. */
  onPress?: () => void;
};

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

/** How many people the strip shows: the phone badge's number. */
export function useSpacePresenceCount(): () => number {
  const clients = useSpaceParticipants();
  return () => clients().length;
}

/**
 * One face per person connected to the space room this device holds, with
 * their profile and participant color: what the members button and the
 * games list's "In this space" line both show.
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

/** {@link SpacePresenceStripView} for the space room this device holds. */
export function SpacePresenceStrip(
  props: SpacePresenceStripProps
): JSX.Element {
  const faces = useSpacePresenceFaces(() => props.spaceId);
  return (
    <SpacePresenceStripView
      faces={faces()}
      size={props.size}
      compact={props.compact}
      onPress={props.onPress}
    />
  );
}
