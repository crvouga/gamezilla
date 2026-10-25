import { DecideMultiplayerGame } from '@libs/game-matchmaking-shared-ts/match-intent';
import { MATCH_ROOM_MODULE } from '@libs/game-matchmaking-shared-ts/match-room';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { GameDefinition } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import { ROOM_SERVICE_GRANT } from '@pkgs/room-root-shared-ts/service-identity';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
  SubmitSimulationInput,
} from './simulation-messages';
import {
  CheckpointLocalSimulation,
  CheckpointSimulation,
} from './simulation-session-state';

export function simulationCommandPermission(
  message: Message,
  topic: string
): ReturnType<NonNullable<GameDefinition['permissionForCommand']>> {
  if (CheckpointSimulation.is(message) || DecideMultiplayerGame.is(message))
    return {
      key: ROOM_SERVICE_GRANT,
      reason: 'only the game authority records live state',
    };
  if (CheckpointLocalSimulation.is(message))
    return {
      key: PERMISSION.gameCustomCreate,
      reason: 'only the creator records a game on this device',
    };
  const matched = topic.startsWith(`${MATCH_ROOM_MODULE}:`);
  if (SimulationStateChanged.is(message))
    return {
      key: matched ? ROOM_SERVICE_GRANT : PERMISSION.gameCustomCreate,
      reason: 'only the creator shares a game running on this device',
    };
  if (SubmitSimulationInput.is(message))
    return {
      key: matched ? PERMISSION.gameMultiplayerPlay : PERMISSION.gameCustomPlay,
      reason: 'only participants may play',
    };
  if (RequestSimulationSnapshot.is(message))
    return {
      key: matched
        ? PERMISSION.gameMultiplayerWatch
        : PERMISSION.gameCustomWatch,
      reason: 'join the space to watch',
    };
  return null;
}
