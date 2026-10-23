import { findOpponentMutation } from '@libs/game-matchmaking-shared-ts/find-opponent-mutation';
import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared-ts/game-repository';
import { activeCustomGamesOf } from '@libs/game-session-shared-ts/custom-game-participation';
import { requireUnfinishedGamesInMutation } from '@libs/permissions-shared-ts/unfinished-games-permission';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared-ts/mutations-types';

/**
 * Finding an opponent is refused to a participant of an active Custom
 * Game. The games live in the space rooms, which only the server reads, so
 * the replay checks them before the body (which checks the multiplayer limit
 * alone, the same on the device and the server).
 */
export function opponentSearchGuard(
  rooms: Pick<RoomServicePort, 'read'>
): MutationAuthorize {
  return async (ctx) => {
    if (ctx.name !== findOpponentMutation.name) return;
    const person = ctx.env.actorId;
    await requireUnfinishedGamesInMutation(ctx, {
      multiplayer: await new MultiplayerGameRepository(ctx.tx).unfinishedCount(
        person
      ),
      customGames: await activeCustomGamesOf(ctx.tx, rooms, person),
    });
  };
}
