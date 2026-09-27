import type { TopicMap } from '@pkgs/sync-engine/shared';

export const PERMISSIONS_TOPIC_MAP = {
  permissions_quota_ledger: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}`];
    },
  },
} satisfies TopicMap;
