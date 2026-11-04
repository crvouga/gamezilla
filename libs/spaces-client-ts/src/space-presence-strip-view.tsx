/**
 * Connected-member presence strip for space chrome (one face per member).
 * Before anyone else's presence arrives it shows the people glyph, so the
 * members button is never an empty disc. On a phone (`compact`) it is the
 * people glyph with how many are here, one button wide, so it stays beside
 * the title instead of folding into More.
 */

import type { ParticipantColor } from '@pkgs/collab-root-shared-ts/participant-color';
import { resolveParticipantColor } from '@pkgs/collab-root-shared-ts/participant-color';
import { PresenceStrip } from '@pkgs/collab-ui-client-ts/presence-strip';
import type { RoomActor } from '@pkgs/room-root-shared-ts/types';
import { BadgedIcon } from '@pkgs/ui-root-client-ts/badged-icon';
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
  /** One button wide: the people glyph and how many are here. */
  readonly compact?: boolean | undefined;
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
  const glyph = (): JSX.Element => (
    <UsersIcon size={Math.round(props.size * 0.6)} color="icon" />
  );
  return (
    <Show when={props.faces.length > 0} fallback={glyph()}>
      <Show
        when={props.compact !== true}
        fallback={
          <BadgedIcon badge={props.faces.length} intent="neutral">
            {glyph()}
          </BadgedIcon>
        }
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
    </Show>
  );
}
