import {
  customGameCmdNs,
  customGameEvtNs,
} from '@libs/chess-custom-game-shared/custom-game-commands';
import {
  customGameEffects,
  localCustomGameEffects,
} from '@libs/chess-custom-game-shared/custom-game-effects';
import { prepareLocalCustomGameCommand } from '@libs/chess-custom-game-shared/custom-game-local';
import { customGameCommandPermission } from '@libs/chess-custom-game-shared/custom-game-permissions';
import {
  customGameCommandRouter,
  customGameEventReducer,
  customGameInitialAttrs,
} from '@libs/chess-custom-game-shared/custom-game-router';
import { reactCustomGameToSpaceEvent } from '@libs/chess-custom-game-shared/custom-game-space-events';
import { CustomGamesAttr } from '@libs/chess-custom-game-shared/custom-game-state';
import { matchRoomModule } from '@libs/chess-matchmaking-shared/match-room';
import { chessPuzzleGame } from '@libs/chess-puzzle-shared/chess-game';
import type { GameDefinition } from '@libs/spaces-shared/game';

/** Chess composes puzzles and Custom Games into the space's one room. */
export const chessGameShared: GameDefinition = {
  ...chessPuzzleGame,
  matchRooms: [matchRoomModule],
  prepareLocalCommand: prepareLocalCustomGameCommand,
  recoverLocalEffects: (state) =>
    localCustomGameEffects(CustomGamesAttr.from(state).current),
  recoverEffects: (state) =>
    customGameEffects(CustomGamesAttr.from(state).current),
  reactToSpaceEvent: reactCustomGameToSpaceEvent,
  permissionForCommand: customGameCommandPermission,
  commandRouters: [
    ...chessPuzzleGame.commandRouters,
    { namespace: customGameCmdNs, router: customGameCommandRouter },
  ],
  eventRouters: [
    ...chessPuzzleGame.eventRouters,
    { namespace: customGameEvtNs, router: customGameEventReducer },
  ],
  initialState: () => ({
    ...chessPuzzleGame.initialState?.(),
    ...customGameInitialAttrs(),
  }),
};
