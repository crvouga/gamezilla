import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import { multiplayerTopics } from './multiplayer-topics';
export const MULTIPLAYER_TOPIC_MAP = {
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
  /**
   * A private setup reaches only its owner's devices: a change wakes the
   * owner alone, and the setup itself never travels as a row image (not
   * even on the owner's channel), so their devices read it through their
   * own authorized query.
   */
  chess_multiplayer_setups: {
    topics(row, ctx) {
      return [`user:${String(row['owner_id'] ?? ctx.actorId)}`];
    },
    rowImage: { publish: () => false },
  },
  chess_multiplayer_commands: {
    topics(row, ctx) {
      return [`user:${String(row['owner_id'] ?? ctx.actorId)}`];
    },
  },
} satisfies TopicMap;
