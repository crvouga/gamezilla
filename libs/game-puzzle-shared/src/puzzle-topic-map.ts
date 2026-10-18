import type { TopicMap } from '@pkgs/sync-engine-shared/topic-map';
import { puzzleCatalogueTopic } from './catalogue-topics';

/**
 * Wake topics of the puzzle tables: a person's progress and preferences
 * wake only their own devices, and the catalogue wakes everyone holding it.
 */
export const PUZZLE_TOPIC_MAP = {
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
  chess_puzzles: {
    topics() {
      return [puzzleCatalogueTopic()];
    },
    fallbackTopics() {
      return [puzzleCatalogueTopic()];
    },
  },
} satisfies TopicMap;
