import { MULTIPLAYER_MUTATIONS } from '@libs/game-matchmaking-shared-ts/multiplayer-mutations';
import { multiplayerSessionQuery } from '@libs/game-matchmaking-shared-ts/multiplayer-session-query';
import { multiplayerSpaceQuery } from '@libs/game-matchmaking-shared-ts/multiplayer-space-query';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import { MULTIPLAYER_TOPIC_MAP } from '@libs/game-matchmaking-shared-ts/topic-map';
import { defineSub } from '@libs/sub-shared-ts/manifest';
import type { RegisteredGame } from '@pkgs/turn-game-shared-ts/game-rules';
import { GAME_SESSION_PRIVACY } from './account-privacy';
import {
  CUSTOM_GAME_SEATS_TABLES,
  CUSTOM_GAME_SEATS_TOPIC_MAP,
  customGameSeatsQuery,
  noteCustomGameSeatsMutation,
} from './custom-game-seats';
/** No game is named here: composition roots supply their rules registrations. */
export function createGameSessionSub(games: readonly RegisteredGame[]) {
  return defineSub({
    name: 'game-session',
    turnGames: games,
    tables: [...MULTIPLAYER_TABLES, ...CUSTOM_GAME_SEATS_TABLES],
    readsForeign: ['profile', 'spaces'],
    topicMap: { ...MULTIPLAYER_TOPIC_MAP, ...CUSTOM_GAME_SEATS_TOPIC_MAP },
    accountPrivacy: GAME_SESSION_PRIVACY,
    queries: [
      multiplayerSessionQuery,
      multiplayerSpaceQuery,
      customGameSeatsQuery,
    ],
    sessionQueries: ['chessMultiplayerSession', customGameSeatsQuery.name],
    mutations: async () => [
      ...MULTIPLAYER_MUTATIONS,
      noteCustomGameSeatsMutation,
    ],
  });
}
