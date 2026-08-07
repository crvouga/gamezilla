import type { Topic } from '@pkgs/pubsub/interface';

/** Shared topic so all shapes-app sim clients receive the same push stream. */
export const SHAPES_WORLD_TOPIC = 'user:shapes-world' as Topic;
