/**
 * The pubsub topic a space's rows arrive on. Spaces owns the shape, because
 * spaces is what knows a room is a space.
 */

import type { Topic } from '@pkgs/pubsub/interface';

export function roomTopic(spaceId: string): Topic {
  return `room:${spaceId}`;
}

/** The authoritative room a device connects to for this space. */
export function spaceRoomTopic(spaceId: string): string {
  return `space:${spaceId}`;
}
