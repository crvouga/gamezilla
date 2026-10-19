/**
 * The chess sub's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about chess
 * that anything outside it may depend on: its Lichess puzzle import. The
 * puzzles themselves are the platform's (`GAME_PUZZLE_SUB`).
 */

import { CHESS_TOPIC_MAP } from '@libs/chess-root-shared/topic-map';
import { defineSub } from '@libs/sub-shared/manifest';
import { CHESS_TABLES } from './chess-tables';
import { CHESS_MUTATIONS } from './mutations';
import { CHESS_QUERIES } from './queries';

export const CHESS_SUB = defineSub({
  name: 'chess',
  tables: CHESS_TABLES,
  readsForeign: [],
  topicMap: CHESS_TOPIC_MAP,
  queries: CHESS_QUERIES,
  mutations: async () => CHESS_MUTATIONS,
});
