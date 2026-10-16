import { CHESS_MUTATIONS } from './mutations';
/**
 * The chess sub's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about chess
 * that anything outside it may depend on.
 */

import { CHESS_TOPIC_MAP } from '@libs/chess-root-shared/topic-map';
import { defineSub } from '@libs/sub-shared/manifest';
import { CHESS_PRIVACY } from './account-privacy';
import { CHESS_TABLES } from './chess-tables';
import { CHESS_QUERIES } from './queries';

export const CHESS_SUB = defineSub({
  name: 'chess',
  accountPrivacy: CHESS_PRIVACY,
  tables: CHESS_TABLES,
  readsForeign: [],
  topicMap: CHESS_TOPIC_MAP,
  // Held open for the whole session: what keeps this sub's slice
  // of the local database warm.
  sessionQueries: [
    'chessPuzzleProfile',
    'chessPuzzleFeedSettings',
    'chessPuzzleInteractions',
    'chessPuzzleRatingEvents',
  ],
  queries: CHESS_QUERIES,
  mutations: async () => CHESS_MUTATIONS,
});
