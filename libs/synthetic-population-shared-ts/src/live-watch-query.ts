import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';

/**
 * Whether one of the actor's own apps is being watched live. Only the
 * watched account's devices receive it; it names no watcher.
 */
export const myLiveWatches = defineQuery({
  name: 'myLiveWatches',
  async run(ctx) {
    return {
      population_live_watches: await ctx.db.query(sql`
        SELECT id, account_id, device_id, watched_until, created_at, updated_at, deleted_at
        FROM population_live_watches WHERE account_id = ${ctx.env.actorId}
      `),
    };
  },
});

export const SYNTHETIC_POPULATION_TOPIC_MAP = {
  population_live_watches: {
    topics(row, ctx) {
      return [`user:${String(row['account_id'] ?? ctx.actorId)}`];
    },
    fallbackTopics(ctx) {
      return [`user:${ctx.actorId}`];
    },
    rowImage: { publish: () => false },
  },
} satisfies TopicMap;
