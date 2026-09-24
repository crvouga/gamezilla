/**
 * The pubsub topic a space's rows arrive on. Spaces owns the shape, because
 * spaces is what knows a room is a space.
 */

import type { Topic } from '@pkgs/pubsub/interface';

export function roomTopic(spaceId: string): Topic {
  return `room:${spaceId}`;
}
