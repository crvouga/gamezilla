import type { TopicMap } from '@pkgs/sync-engine/shared';
import { chessPuzzlesTopic } from '../shared/sync-topics';

export const CHESS_TOPIC_MAP = {
  chess_puzzle_profiles: {
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
      return [chessPuzzlesTopic()];
    },
    fallbackTopics() {
      return [chessPuzzlesTopic()];
    },
  },
} satisfies TopicMap;
