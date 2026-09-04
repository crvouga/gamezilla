import type { Topic } from '@pkgs/pubsub/interface';

/** Shared topic so all example-app sim clients receive the same push stream. */
export const NOTES_ALL_TOPIC = 'user:notes-all' as Topic;

export function userTopic(actorId: string): Topic {
  return `user:${actorId}` as Topic;
}

export function roomTopic(spaceId: string): Topic {
  return `room:${spaceId}` as Topic;
}
