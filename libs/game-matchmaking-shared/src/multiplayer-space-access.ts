import { decideInMutation } from '@libs/permissions-shared/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { storedSpacePresence } from '@libs/spaces-shared/stored-space-presence';
import sql from '@pkgs/sql-root-shared/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';

export async function multiplayerSpaceScope(ctx: MutationCtx, spaceId: string) {
  return {
    spacePresence: await storedSpacePresence(ctx.tx, spaceId, {
      memberId: ctx.env.actorId,
      accountId: ctx.env.accountId ?? null,
      deviceId: ctx.env.deviceId ?? ctx.env.actorId,
    }),
  };
}

export async function requireMultiplayerSpace(
  ctx: MutationCtx,
  spaceId: string
) {
  const scope = await multiplayerSpaceScope(ctx, spaceId);
  const decision = await decideInMutation(
    ctx,
    PERMISSION.gameMultiplayerWatch,
    scope
  );
  if (!decision.allowed)
    throw new MutationError(
      'CHESS_SPACE_REQUIRED',
      'Multiplayer game needs a space.'
    );
  return scope;
}

export async function requireMultiplayerParticipant(
  ctx: MutationCtx,
  args: { spaceId: string; gameId: string }
) {
  const scope = await multiplayerSpaceScope(ctx, args.spaceId);
  const watch = await decideInMutation(
    ctx,
    PERMISSION.gameMultiplayerWatch,
    scope
  );
  if (!watch.allowed)
    throw new MutationError(
      'CHESS_GAME_UNAVAILABLE',
      'No multiplayer game is available to you.'
    );
  const rows = await ctx.tx.query(sql<{ white_id: string; black_id: string }>`
    SELECT g.white_id, g.black_id FROM chess_multiplayer_games AS g
    JOIN chess_multiplayer_players AS p ON p.game_id = g.id
    JOIN spaces AS s ON s.host_member_id = p.owner_id
    WHERE g.id = ${args.gameId} AND s.id = ${args.spaceId}
      AND s.ended_at IS NULL AND s.deleted_at IS NULL AND g.deleted_at IS NULL AND p.deleted_at IS NULL`);
  const game = rows[0];
  if (game === undefined)
    throw new MutationError(
      'CHESS_GAME_UNAVAILABLE',
      'No multiplayer game is available to you.'
    );
  if (game.white_id !== ctx.env.actorId && game.black_id !== ctx.env.actorId)
    throw new MutationError(
      'CHESS_MATCHED_ONLY',
      'Only the matched people can move multiplayer pieces.'
    );
}
