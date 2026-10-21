import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';

/** Shared topic so all example-app harness clients receive the same push stream. */
export const NOTES_ALL_TOPIC = 'user:notes-all' as Topic;

export function userTopic(actorId: string): Topic {
  return `user:${actorId}` as Topic;
}

export function roomTopic(spaceId: string): Topic {
  return `room:${spaceId}` as Topic;
}
