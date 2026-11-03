/**
 * Connected-member presence strip for space chrome (one face per member).
 * Before anyone else's presence arrives it shows the people glyph, so the
 * members button is never an empty disc.
 */

import type { ParticipantColor } from '@pkgs/collab-root-shared-ts/participant-color';
import { resolveParticipantColor } from '@pkgs/collab-root-shared-ts/participant-color';
import { PresenceStrip } from '@pkgs/collab-ui-client-ts/presence-strip';
import type { RoomActor } from '@pkgs/room-root-shared-ts/types';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar } from './space-person-view';

/** One connected participant's face: who, and their participant color. */
export type SpacePresenceFace = {
  readonly actor: RoomActor;
  readonly person: SpacePerson | null;
  readonly color: ParticipantColor;
};

export type SpacePresenceStripViewProps = {
  /** One face per participant, in roster order. */
  readonly faces: readonly SpacePresenceFace[];
  readonly size: number;
  /**
   * Optional standalone press handler. Omit when embedded in an ActionBar /
   * IconButton that already owns the press target (nested buttons are invalid).
   */
  readonly onPress?: (() => void) | undefined;
};

/** The faces of who is connected, or the people glyph before anyone is. */
export function SpacePresenceStripView(
  props: SpacePresenceStripViewProps
): JSX.Element {
  const colorFor = (id: string): ParticipantColor =>
    props.faces.find((face) => face.actor.id === id)?.color ??
    resolveParticipantColor(id);
  const personFor = (id: string): SpacePerson | null =>
    props.faces.find((face) => face.actor.id === id)?.person ?? null;
  return (
    <Show
      when={props.faces.length > 0}
      fallback={<UsersIcon size={Math.round(props.size * 0.6)} color="icon" />}
    >
      <PresenceStrip
        clients={props.faces.map((face) => face.actor)}
        colorForParticipant={colorFor}
        renderAvatar={(actor, avatarSize) => (
          <SpacePersonAvatar person={personFor(actor.id)} size={avatarSize} />
        )}
        size={props.size}
        maxVisible={4}
        {...(props.onPress !== undefined ? { onPress: props.onPress } : {})}
      />
    </Show>
  );
}
