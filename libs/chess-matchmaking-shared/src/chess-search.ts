import {
  requireInMutation,
  requireLimitInMutation,
} from '@libs/permissions-shared/mutation-permission';
import { LIMIT, PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { asKeywordRecord } from '@pkgs/keyword-shared/keyword';
import { SearchCommands } from '@pkgs/matchmaking-sql-shared/search-commands';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import sql from '@pkgs/sql-root-shared/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { MultiplayerGameRepository } from './game-repository';
import { requireMultiplayerSpace } from './multiplayer-space-access';
import { OpponentRequested } from './opponent-requested';
import { MultiplayerRatingRepository } from './rating-repository';
import {
  CHESS_POOL_KEY,
  CHESS_RATING_KEY,
  CHESS_SEARCH_FORMULAS,
  CHESS_SEARCH_SCHEMA,
  CHESS_TIME_CONTROL_KEY,
  chessOpponentPool,
} from './search-config';
import { projectOpponentSearch } from './search-projection';
import type { TimeControl } from './time-control';
import { timeControlOf } from './time-control';

export function requireOfferedTimeControl(id: string): TimeControl {
  const control = timeControlOf(id);
  if (control === null)
    throw new MutationError(
      'CHESS_TIME_CONTROL_NOT_OFFERED',
      `${id} is not an offered time control.`
    );
  return control;
}

function alreadyLooking(): MutationError {
  return new MutationError(
    'CHESS_ALREADY_LOOKING',
    'You are already looking for a chess opponent.'
  );
}

/** A search ends any multiplayer rematch offer of the person's latest game. */
async function endRematchOffer(ctx: MutationCtx, iso: string): Promise<void> {
  await ctx.tx.run(sql`UPDATE chess_multiplayer_games SET rematch_offer_by = ${''}, updated_at = ${iso}
    WHERE id IN (SELECT game_id FROM chess_multiplayer_players WHERE owner_id = ${ctx.env.actorId} AND deleted_at IS NULL)
      AND rematch_offer_by <> ${''} AND deleted_at IS NULL`);
}

/**
 * Asks matchmaking for an opponent at one offered time control, paired by
 * the person's multiplayer rating for its speed.
 */
export async function beginChessSearch(
  ctx: MutationCtx,
  input: {
    readonly requestId: string;
    readonly timeControl: string;
    readonly spaceId: string;
  }
): Promise<void> {
  await requireInMutation(ctx, PERMISSION.matchmakingUse);
  const scope = await requireMultiplayerSpace(ctx, input.spaceId);
  await requireInMutation(ctx, PERMISSION.spacesSelectGame, scope);
  const control = requireOfferedTimeControl(input.timeControl);
  const checkLimit = async () =>
    requireLimitInMutation(
      ctx,
      LIMIT.unfinishedMultiplayerGames,
      await new MultiplayerGameRepository(ctx.tx).unfinishedCount(
        ctx.env.actorId
      )
    );
  const serverNow = ctx.env.serverNow;
  if (serverNow === undefined) {
    await checkLimit();
    return;
  }
  const now = () => serverNow().getTime();
  const rating = await new MultiplayerRatingRepository(ctx.tx).read(
    ctx.env.actorId,
    control.speed
  );
  const result = await new SearchCommands(ctx.tx, {
    now,
    schema: CHESS_SEARCH_SCHEMA,
    authorizeBegin: checkLimit,
  }).begin({
    ownerId: ctx.env.actorId,
    requestId: input.requestId,
    data: asKeywordRecord(
      {
        [CHESS_POOL_KEY]: chessOpponentPool(control.id),
        [CHESS_RATING_KEY]: rating.rating,
        [CHESS_TIME_CONTROL_KEY]: control.id,
      },
      'chess opponent search'
    ),
    formulas: CHESS_SEARCH_FORMULAS,
    groupSize: 2,
  });
  if (result.outcome === 'unavailable')
    throw new MutationError(
      'CHESS_UNAVAILABLE',
      'Multiplayer chess is unavailable.'
    );
  if (result.outcome === 'already_waiting') throw alreadyLooking();
  await endRematchOffer(ctx, new Date(now()).toISOString());
  await projectOpponentSearch(ctx.tx, ctx.env.actorId, now());
  await new Outbox(ctx).send({
    id: `chess.opponent-requested:${JSON.stringify([ctx.env.actorId, input.requestId])}`,
    message: OpponentRequested({ ownerId: ctx.env.actorId }),
  });
}
