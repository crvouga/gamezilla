import type { GameDefinition } from '@libs/spaces/public/game';
import { chessPuzzleGame } from '../shared/chess/chess-game';
import { CustomGamesAttr } from '../shared/custom-game/custom-game-state';
import {
  customGameCmdNs,
  customGameEvtNs,
} from '../use-cases/change-custom-game/shared/custom-game-commands';
import { customGameEffects } from '../use-cases/change-custom-game/shared/custom-game-effects';
import { customGameCommandPermission } from '../use-cases/change-custom-game/shared/custom-game-permissions';
import {
  customGameCommandRouter,
  customGameEventReducer,
  customGameInitialAttrs,
} from '../use-cases/change-custom-game/shared/custom-game-router';
import { reactCustomGameToSpaceEvent } from '../use-cases/change-custom-game/shared/custom-game-space-events';

export { CHESS_GAME_ID } from '../shared/chess/chess-game';

/** Chess composes puzzles and Custom Games into the space's one room. */
export const chessGameShared: GameDefinition = {
  ...chessPuzzleGame,
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
