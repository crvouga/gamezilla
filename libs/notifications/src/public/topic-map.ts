import type { TopicMap } from '@pkgs/sync-engine/shared';

export const NOTIFICATIONS_TOPIC_MAP = {
  notifications: {
    topics(row, ctx) {
      const uid = String(row['user_id'] ?? ctx.actorId);
      return [`user:${uid}`];
    },
  },
} satisfies TopicMap;
