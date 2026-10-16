import { matchRoomModule } from '@libs/game-matchmaking-shared/match-room';
import type { GameRoomCapability } from '@libs/spaces-shared/game';
import { withCustomGames } from './custom-game-definition';
/** One session engine per space, independent of which games are registered. */
export const GAME_ROOM_CAPABILITY: GameRoomCapability = {
  id: 'turn-game-session',
  bind: (rules) =>
    withCustomGames(
      {
        id: 'turn-game-session',
        commandRouters: [],
        eventRouters: [],
        recoverEffects: () => [],
        matchRooms: [matchRoomModule],
      },
      rules
    ),
};
