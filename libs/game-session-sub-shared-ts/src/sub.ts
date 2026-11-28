import { MULTIPLAYER_MUTATIONS } from '@libs/game-matchmaking-shared-ts/multiplayer-mutations';
import { multiplayerSessionQuery } from '@libs/game-matchmaking-shared-ts/multiplayer-session-query';
import { multiplayerSpaceQuery } from '@libs/game-matchmaking-shared-ts/multiplayer-space-query';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import { MULTIPLAYER_TOPIC_MAP } from '@libs/game-matchmaking-shared-ts/topic-map';
import { defineSub } from '@libs/sub-shared-ts/manifest';
import type { RegisteredGame } from '@pkgs/turn-game-shared-ts/game-rules';
import { GAME_SESSION_PRIVACY } from './account-privacy';
import {
  GAME_SESSION_SEATS_TABLES,
  GAME_SESSION_SEATS_TOPIC_MAP,
  gameSessionSeatsQuery,
  noteGameSessionSeatsMutation,
} from './game-session-seats';
/** No game is named here: composition roots supply their rules registrations. */
export function createGameSessionSub(games: readonly RegisteredGame[]) {
  return defineSub({
    name: 'game-session',
    turnGames: games,
    tables: [...MULTIPLAYER_TABLES, ...GAME_SESSION_SEATS_TABLES],
    readsForeign: ['profile', 'spaces'],
    topicMap: { ...MULTIPLAYER_TOPIC_MAP, ...GAME_SESSION_SEATS_TOPIC_MAP },
    accountPrivacy: GAME_SESSION_PRIVACY,
    queries: [
      multiplayerSessionQuery,
      multiplayerSpaceQuery,
      gameSessionSeatsQuery,
    ],
    sessionQueries: ['chessMultiplayerSession', gameSessionSeatsQuery.name],
    mutations: async () => [
      ...MULTIPLAYER_MUTATIONS,
      noteGameSessionSeatsMutation,
    ],
  });
}
