/**
 * The chess feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about chess
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { CHESS_TABLES } from '../public/schema';
import { CHESS_TOPIC_MAP } from '../public/topic-map';
import { CHESS_PRIVACY } from '../shared/puzzles/account-privacy';
import { CHESS_QUERIES } from './queries';

export const CHESS_FEATURE = defineFeature({
  name: 'chess',
  accountPrivacy: CHESS_PRIVACY,
  tables: CHESS_TABLES,
  topicMap: CHESS_TOPIC_MAP,
  // Held open for the whole session: what keeps this feature's slice
  // of the local database warm.
  sessionQueries: [
    'chessMultiplayerSession',
    'chessPuzzleProfile',
    'chessPuzzleFeedSettings',
    'chessPuzzleInteractions',
    'chessPuzzleRatingEvents',
  ],
  queries: CHESS_QUERIES,
  mutations: async () => (await import('./mutations')).CHESS_MUTATIONS,
});
