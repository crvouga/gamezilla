import { CLIENT_CONFIG_SUB } from '@libs/app-config-shared-ts/sub';
import { AUTH_SUB } from '@libs/auth-shared-ts/sub';
import { BILLING_SUB } from '@libs/billing-shared-ts/sub';
import { CHESS_SUB } from '@libs/chess-sub-shared-ts/sub';
import { chessPuzzles } from '@libs/game-puzzle-shared-ts/puzzle-tables';
import { PUZZLE_TOPIC_MAP } from '@libs/game-puzzle-shared-ts/puzzle-topic-map';
import { PERMISSIONS_SUB } from '@libs/permissions-shared-ts/sub';
import { PROFILE_SUB } from '@libs/profile-shared-ts/sub';
import { composeSubs } from '@libs/sub-shared-ts/compose';
import { defineSub } from '@libs/sub-shared-ts/manifest';

/** Imports count the shared catalogue locally and notify players when a batch lands. */
const catalogue = defineSub({
  name: 'puzzle-catalogue',
  tables: [chessPuzzles],
  topicMap: { chess_puzzles: PUZZLE_TOPIC_MAP.chess_puzzles },
  queries: [],
  mutations: async () => [],
});

export const ADMIN_APP = composeSubs([
  AUTH_SUB,
  PROFILE_SUB,
  CLIENT_CONFIG_SUB,
  BILLING_SUB,
  PERMISSIONS_SUB,
  catalogue,
  CHESS_SUB,
]);
