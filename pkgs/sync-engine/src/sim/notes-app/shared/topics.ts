import type { Topic } from '@pkgs/pubsub/interface';

/** Shared topic so all notes-app sim clients receive the same push stream. */
export const NOTES_WORLD_TOPIC = 'user:notes-world' as Topic;
