import type { GameDefinition } from '@libs/spaces-shared-ts/game';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { createGameSessionAvailabilityChange } from './game-session-availability';
import { gameSessionCmdNs, gameSessionEvtNs } from './game-session-commands';
import { gameSessionCommitmentAudience } from './game-session-commitments';
import {
  gameSessionEffects,
  localGameSessionEffects,
} from './game-session-effects';
import { gameSessionHandsAudience } from './game-session-hands';
import { prepareLocalGameSessionCommand } from './game-session-local';
import { gameSessionCommandPermission } from './game-session-permissions';
import {
  createGameSessionCommandRouter,
  gameSessionEventReducer,
  gameSessionInitialAttrs,
} from './game-session-router';
import { gameSessionSetupAudience } from './game-session-setup';
import { reactGameSessionToSpaceEvent } from './game-session-space-events';
import { gameSessionStandInEffects } from './game-session-stand-in';
import { GameSessionsAttr } from './game-session-state';

/** One game-session lifecycle per space, composed once alongside playable plugins. */
export function withGameSessions(
  game: GameDefinition,
  rules: TurnGames
): GameDefinition {
  // Only a game with private setups or dealt hands makes any game-session
  // event private.
  const privately = rules.games.some(
    (g) =>
      g.rules.setup !== undefined ||
      rules.turnsForPosition(g.rules.initial())?.hands !== undefined
  );
  return {
    ...game,
    ...(privately
      ? {
          audience: (event) =>
            gameSessionSetupAudience(event) ??
            gameSessionHandsAudience(event) ??
            gameSessionCommitmentAudience(event),
        }
      : {}),
    availabilityChange: createGameSessionAvailabilityChange(rules),
    prepareLocalCommand: (state, payload, at, random) =>
      prepareLocalGameSessionCommand(state, payload, { at, random }, rules),
    recoverLocalEffects: (state) =>
      localGameSessionEffects(GameSessionsAttr.from(state).current, rules),
    recoverEffects: (state) => [
      ...game.recoverEffects(state),
      ...gameSessionEffects(GameSessionsAttr.from(state).current, rules),
      ...gameSessionStandInEffects(
        state,
        GameSessionsAttr.from(state).current,
        rules
      ),
    ],
    reactToSpaceEvent: (state, ctx, event) =>
      reactGameSessionToSpaceEvent(state, ctx, event, rules),
    // While a game session is under way the space stays on its board.
    holdsSpace: (state) => {
      const game = GameSessionsAttr.from(state).current;
      return game?.status === 'active' ? game.mode : null;
    },
    permissionForCommand: gameSessionCommandPermission,
    commandRouters: [
      ...game.commandRouters,
      {
        namespace: gameSessionCmdNs,
        router: createGameSessionCommandRouter(rules),
      },
    ],
    eventRouters: [
      ...game.eventRouters,
      { namespace: gameSessionEvtNs, router: gameSessionEventReducer },
    ],
    initialState: () => ({
      ...game.initialState?.(),
      ...gameSessionInitialAttrs(),
    }),
  };
}
