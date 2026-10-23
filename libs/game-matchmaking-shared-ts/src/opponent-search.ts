import {
  requireInMutation,
  requireLimitInMutation,
} from '@libs/permissions-shared-ts/mutation-permission';
import {
  LIMIT,
  PERMISSION,
} from '@libs/permissions-shared-ts/permission-catalog';
import { asKeywordRecord } from '@pkgs/keyword-shared-ts/keyword';
import { SearchCommands } from '@pkgs/matchmaking-sql-shared-ts/search-commands';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import {
  requireTurnGames,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { MultiplayerGameRepository } from './game-repository';
import { requireMultiplayerSpace } from './multiplayer-space-access';
import { OpponentRequested } from './opponent-requested';
import { MultiplayerRatingRepository } from './rating-repository';
import {
  OPPONENT_POOL_KEY,
  OPPONENT_RATING_KEY,
  OPPONENT_SEARCH_FORMULAS,
  OPPONENT_SEARCH_SCHEMA,
  OPPONENT_TIME_CONTROL_KEY,
  opponentPool,
} from './search-config';
import { projectOpponentSearch } from './search-projection';
import type { TimeControl } from './time-control';
import { offeredTimeControls } from './time-control';

export function requireOfferedTimeControl(
  id: string,
  rules: TurnGames
): TimeControl {
  const control =
    offeredTimeControls(rules).find((offered) => offered.id === id) ?? null;
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
    'You are already looking for an opponent.'
  );
}

/**
 * The account's search is one search, including one started from another
 * space. The projected row is what every device already has. Matchmaking
 * tables live only on the server, so a client replay cannot read them.
 */
async function refuseWhenAlreadyLooking(ctx: MutationCtx): Promise<void> {
  const projected = await ctx.tx.query(sql<{ id: string }>`
    SELECT id FROM chess_opponent_searches
    WHERE owner_id = ${ctx.env.actorId} AND standing = ${'waiting'} AND deleted_at IS NULL
    LIMIT 1`);
  if (projected.length > 0) throw alreadyLooking();
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
export async function beginOpponentSearch(
  ctx: MutationCtx,
  input: {
    readonly requestId: string;
    readonly timeControl: string;
    readonly spaceId: string;
  }
): Promise<void> {
  await requireInMutation(ctx, PERMISSION.matchmakingUse);
  await refuseWhenAlreadyLooking(ctx);
  const scope = await requireMultiplayerSpace(ctx, input.spaceId);
  await refuseWhenAlreadyLooking(ctx);
  await requireInMutation(ctx, PERMISSION.spacesSelectGame, scope);
  const control = requireOfferedTimeControl(
    input.timeControl,
    requireTurnGames(ctx.env)
  );
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
    schema: OPPONENT_SEARCH_SCHEMA,
    authorizeBegin: checkLimit,
  }).begin({
    ownerId: ctx.env.actorId,
    requestId: input.requestId,
    data: asKeywordRecord(
      {
        [OPPONENT_POOL_KEY]: opponentPool(
          control.id,
          requireTurnGames(ctx.env)
        ),
        [OPPONENT_RATING_KEY]: rating.rating,
        [OPPONENT_TIME_CONTROL_KEY]: control.id,
      },
      'opponent search'
    ),
    formulas: OPPONENT_SEARCH_FORMULAS,
    groupSize: 2,
  });
  if (result.outcome === 'unavailable')
    throw new MutationError(
      'CHESS_UNAVAILABLE',
      'Multiplayer game is unavailable.'
    );
  if (result.outcome === 'already_waiting') throw alreadyLooking();
  await endRematchOffer(ctx, new Date(now()).toISOString());
  await projectOpponentSearch(ctx.tx, ctx.env.actorId, now());
  await new Outbox(ctx).send({
    id: `chess.opponent-requested:${JSON.stringify([ctx.env.actorId, input.requestId])}`,
    message: OpponentRequested({ ownerId: ctx.env.actorId }),
  });
}
