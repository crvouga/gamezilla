import { CHESS_TOPIC_MAP } from '@libs/chess-root-shared-ts/topic-map';
import { defineSub } from '@libs/sub-shared-ts/manifest';
import { CHESS_TABLES } from './chess-tables';

/** Shared database ownership and worker notifications for the catalogue loader. */
export const CHESS_STORAGE = defineSub({
  name: 'chess',
  tables: CHESS_TABLES,
  topicMap: CHESS_TOPIC_MAP,
  queries: [],
  mutations: async () => [],
});
