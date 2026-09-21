/**
 * Product topics that are not the platform's to define. `user:<id>` and the
 * entry-channel rule live in `@libs/feature/public/sync`; a room topic is a
 * product arrangement between spaces and the room Worker.
 */

import type { Topic } from '@pkgs/pubsub/interface';

export function roomTopic(spaceId: string): Topic {
  return `room:${spaceId}`;
}
