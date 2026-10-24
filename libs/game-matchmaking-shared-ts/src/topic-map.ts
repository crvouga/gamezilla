import type {
  TopicMap,
  TopicMapEntry,
} from '@pkgs/sync-engine-shared-ts/topic-map';
import {
  multiplayerTopics,
  multiplayerTopicsByRow,
} from './multiplayer-topics';

const ownedRows: TopicMapEntry = {
  topics(row, ctx, db) {
    return multiplayerTopics([String(row['owner_id'] ?? ctx.actorId)], db);
  },
  topicsByRow(rows, ctx, db) {
    return multiplayerTopicsByRow(
      rows.map((row) => [String(row['owner_id'] ?? ctx.actorId)]),
      db
    );
  },
};

export const MULTIPLAYER_TOPIC_MAP = {
  chess_multiplayer_games: {
    topics(row, _ctx, db) {
      return multiplayerTopics(
        ['white_id', 'black_id', 'red_id', 'blue_id'].map((key) =>
          String(row[key] ?? '')
        ),
        db
      );
    },
    topicsByRow(rows, _ctx, db) {
      return multiplayerTopicsByRow(
        rows.map((row) =>
          ['white_id', 'black_id', 'red_id', 'blue_id'].map((key) =>
            String(row[key] ?? '')
          )
        ),
        db
      );
    },
  },
  chess_multiplayer_players: ownedRows,
  chess_opponent_searches: ownedRows,
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
