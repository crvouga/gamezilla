import { puzzleManagementAudience } from '@libs/permissions-shared/puzzle-management-audience';
import type { TopicMap } from '@pkgs/sync-engine-shared/topic-map';

/** Chess's own table: the Lichess load its puzzle import pipeline keeps. */
export const CHESS_TOPIC_MAP = {
  chess_puzzle_load: {
    // topic-map-db: status rows belong only to the configured puzzle-management audience.
    async topics(row, ctx, db) {
      if (db === undefined)
        return [`user:${String(row['requested_by'] ?? ctx.actorId)}`];
      return (await puzzleManagementAudience(db)).map((id) => `user:${id}`);
    },
  },
} satisfies TopicMap;
