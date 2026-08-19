import type { TopicMap } from '@pkgs/sync-engine/shared';

export const PROFILE_TOPIC_MAP = {
  profile: {
    topics(row, ctx) {
      const id = String(row['id'] ?? ctx.actorId);
      return [`user:${id}`];
    },
    fallbackTopics(ctx) {
      return [`user:${ctx.actorId}`];
    },
  },
} satisfies TopicMap;
