import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { spaceSeatMemberIds } from '@libs/spaces-shared-ts/space-members-messages';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { soloCustomGame } from './custom-game-local';
import { refuseCustomGame } from './custom-game-result';
import { CustomGamesAttr } from './custom-game-state';
import { checkpointCustomSimulation } from './simulation-custom-checkpoint';
import type { LocalSimulationCheckpoint } from './simulation-session-state';

/** The existing offline custom-game queue preserves only its creator's local game. */
export function checkpointLocalSimulation(
  state: RoomState,
  ctx: GameCommandContext,
  checkpoint: LocalSimulationCheckpoint,
  rules: TurnGames
): HandleResult {
  const game = CustomGamesAttr.from(state).current;
  if (
    game === null ||
    game.creator !== ctx.identity ||
    !spaceSeatMemberIds(state).includes(ctx.identity) ||
    !soloCustomGame(game, rules)
  )
    return refuseCustomGame('only the creator records a game on this device');
  if (
    checkpoint.execution.missing.length !== 0 ||
    checkpoint.execution.expiresAt !== null
  )
    return refuseCustomGame(
      'a game on this device cannot claim another person is away'
    );
  return checkpointCustomSimulation(
    state,
    {
      ...ctx,
      identity: ROOM_SERVICE_IDENTITY,
      ts: Math.min(ctx.ts, checkpoint.at),
    },
    checkpoint,
    rules
  );
}
