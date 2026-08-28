import type { Topic } from '@pkgs/pubsub/interface';

/** Shared topic so all acme-app sim clients receive the same push stream. */
export const NOTES_WORLD_TOPIC = 'user:notes-world' as Topic;

export function userTopic(actorId: string): Topic {
  return `user:${actorId}` as Topic;
}

export function roomTopic(spaceId: string): Topic {
  return `room:${spaceId}` as Topic;
}
