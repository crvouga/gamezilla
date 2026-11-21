/**
 * One connected participant's face, as the space's presence hooks
 * (`./space-presence-strip`) hand them to the screens that draw people.
 */

import type { ParticipantColor } from '@pkgs/collab-root-shared-ts/participant-color';
import type { RoomActor } from '@pkgs/room-root-shared-ts/types';
import type { SpacePerson } from './space-person-view';

/** One connected participant's face: who, and their participant color. */
export type SpacePresenceFace = {
  readonly actor: RoomActor;
  readonly person: SpacePerson | null;
  readonly color: ParticipantColor;
};
