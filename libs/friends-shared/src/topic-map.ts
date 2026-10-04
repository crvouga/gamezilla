import type { TopicMap } from '@pkgs/sync-engine-shared/topic-map';

export const FRIENDS_TOPIC_MAP = {
  friends_friendships: {
    topics(row) {
      return [
        `user:${String(row['user_low'])}`,
        `user:${String(row['user_high'])}`,
      ];
    },
  },
  friends_requests: {
    topics(row) {
      return [
        `user:${String(row['from_user_id'])}`,
        `user:${String(row['to_user_id'])}`,
      ];
    },
  },
  friends_blocks: {
    topics(row) {
      return [
        `user:${String(row['blocker_id'])}`,
        `user:${String(row['blocked_id'])}`,
      ];
    },
  },
} satisfies TopicMap;
