import type { TopicMap } from '@pkgs/sync-engine-shared/topic-map';
import { multiplayerTopics } from './multiplayer-topics';
import { chessPuzzlesTopic } from './sync-topics';

export const CHESS_TOPIC_MAP = {
  chess_multiplayer_games: {
    topics(row, _ctx, db) {
      return multiplayerTopics(
        [String(row['white_id'] ?? ''), String(row['black_id'] ?? '')],
        db
      );
    },
  },
  chess_multiplayer_players: {
    topics(row, ctx, db) {
      return multiplayerTopics([String(row['owner_id'] ?? ctx.actorId)], db);
    },
  },
  chess_opponent_searches: {
    topics(row, ctx, db) {
      return multiplayerTopics([String(row['owner_id'] ?? ctx.actorId)], db);
    },
  },
  chess_multiplayer_ratings: {
    topics(row, ctx) {
      return [`user:${String(row['owner_id'] ?? ctx.actorId)}`];
    },
  },
  chess_multiplayer_commands: {
    topics(row, ctx) {
      return [`user:${String(row['owner_id'] ?? ctx.actorId)}`];
    },
  },
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
      return [chessPuzzlesTopic()];
    },
    fallbackTopics() {
      return [chessPuzzlesTopic()];
    },
  },
} satisfies TopicMap;
