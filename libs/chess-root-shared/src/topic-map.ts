import { puzzleManagementAudience } from '@libs/permissions-shared/puzzle-management-audience';
import type { TopicMap } from '@pkgs/sync-engine-shared/topic-map';
import { chessPuzzlesTopic } from './sync-topics';

export const CHESS_TOPIC_MAP = {
  chess_puzzle_profiles: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}`];
    },
  },
  chess_puzzle_feed_settings: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}`];
    },
  },
  chess_puzzle_rating_events: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}`];
    },
  },
  chess_puzzle_interactions: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}`];
    },
  },
  chess_puzzle_load: {
    // topic-map-db: status rows belong only to the configured puzzle-management audience.
    async topics(row, ctx, db) {
      if (db === undefined)
        return [`user:${String(row['requested_by'] ?? ctx.actorId)}`];
      return (await puzzleManagementAudience(db)).map((id) => `user:${id}`);
    },
  },
  chess_puzzles: {
    topics() {
      return [chessPuzzlesTopic()];
    },
    fallbackTopics() {
      return [chessPuzzlesTopic()];
    },
  },
} satisfies TopicMap;
