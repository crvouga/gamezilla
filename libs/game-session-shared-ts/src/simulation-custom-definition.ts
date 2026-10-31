import type {
  GameCommandContext,
  GameDefinition,
} from '@libs/spaces-shared-ts/game';
import { createMessageRouter } from '@pkgs/message-shared-ts/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { CustomGamesAttr } from './custom-game-state';
import { simulationCommandPermission } from './simulation-command-permission';
import {
  checkpointCustomSimulation,
  expireCustomSimulation,
  simulationCustomEffects,
} from './simulation-custom-checkpoint';
import { createCustomSimulationRuntime } from './simulation-custom-runtime';
import { checkpointLocalSimulation } from './simulation-local-checkpoint';
import {
  CheckpointLocalSimulation,
  CheckpointSimulation,
  ExpireSimulation,
  simulationSessionCmdNs,
} from './simulation-session-state';

/** Installs live execution only when some registered game supplies it. */
export function withSimulationCustomGames(
  game: GameDefinition,
  rules: TurnGames
): GameDefinition {
  if (!rules.games.some((entry) => entry.simulation !== undefined)) return game;
  const router = createMessageRouter<
    RoomState,
    GameCommandContext,
    HandleResult
  >(simulationSessionCmdNs)
    .on(CheckpointLocalSimulation, (state, ctx, message) =>
      checkpointLocalSimulation(state, ctx, message.payload, rules)
    )
    .on(CheckpointSimulation, (state, ctx, message) =>
      checkpointCustomSimulation(state, ctx, message.payload, rules)
    )
    .on(ExpireSimulation, (state, ctx, message) =>
      expireCustomSimulation(state, ctx, message.payload, rules)
    );
  return {
    ...game,
    commandRouters: [
      ...game.commandRouters,
      { namespace: simulationSessionCmdNs, router },
    ],
    recoverEffects: (state) => [
      ...game.recoverEffects(state),
      ...simulationCustomEffects(CustomGamesAttr.from(state).current),
    ],
    permissionForCommand: (message, topic) =>
      simulationCommandPermission(message, topic) ??
      game.permissionForCommand?.(message, topic) ??
      null,
    createRuntime: (ports) => createCustomSimulationRuntime(ports, rules),
  };
}
