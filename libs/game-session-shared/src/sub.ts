import { MULTIPLAYER_MUTATIONS } from '@libs/game-matchmaking-shared/multiplayer-mutations';
import { multiplayerSessionQuery } from '@libs/game-matchmaking-shared/multiplayer-session-query';
import { multiplayerSpaceQuery } from '@libs/game-matchmaking-shared/multiplayer-space-query';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared/multiplayer-tables';
import { MULTIPLAYER_TOPIC_MAP } from '@libs/game-matchmaking-shared/topic-map';
import { defineSub } from '@libs/sub-shared/manifest';
import type { RegisteredTurnGame } from '@pkgs/turn-game-shared/game-rules';
import { GAME_SESSION_PRIVACY } from './account-privacy';
/** No game is named here: composition roots supply their rules registrations. */
export function createGameSessionSub(games: readonly RegisteredTurnGame[]) {
  return defineSub({
    name: 'game-session',
    turnGames: games,
    tables: MULTIPLAYER_TABLES,
    readsForeign: ['profile', 'spaces'],
    topicMap: MULTIPLAYER_TOPIC_MAP,
    accountPrivacy: GAME_SESSION_PRIVACY,
    queries: [multiplayerSessionQuery, multiplayerSpaceQuery],
    sessionQueries: ['chessMultiplayerSession'],
    mutations: async () => MULTIPLAYER_MUTATIONS,
  });
}
