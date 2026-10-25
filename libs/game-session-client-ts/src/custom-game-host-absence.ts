import type { RoomActor } from '@pkgs/room-root-shared-ts/types';

/**
 * Whether this device knows the space's host is not in the room: it is
 * connected and the room has said who is present. Before that, a choice
 * goes to the room, which decides.
 */
export function customGameHostKnownAbsent(view: {
  readonly connected: boolean;
  readonly hasRoster: boolean;
  readonly hostId: string | null;
  readonly myId: string;
  readonly roster: readonly RoomActor[];
}): boolean {
  return (
    view.connected &&
    view.hasRoster &&
    view.hostId !== null &&
    view.hostId !== view.myId &&
    !view.roster.some((actor) => actor.id === view.hostId)
  );
}
