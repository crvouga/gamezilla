import { requireInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { readCurrent } from '@pkgs/matchmaking-sql-shared-ts/search-read';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { requireTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { createMultiplayerGame } from './game-creation';
import { MultiplayerGameRepository } from './game-repository';
import type { MultiplayerGame } from './game-state';
import { isFinished, otherPerson } from './game-state';

export type RematchAnswer = 'offer' | 'accept' | 'decline';

async function currentGameOf(tx: SqlTx, ownerId: string) {
  const rows = await tx.query(sql<{ game_id: string | null }>`SELECT game_id
    FROM chess_multiplayer_players WHERE owner_id = ${ownerId} AND deleted_at IS NULL`);
  return rows[0]?.game_id ?? null;
}

async function looking(tx: SqlTx, ownerId: string, nowMs: number) {
  return (await readCurrent(tx, ownerId, nowMs))?.result?.status === 'waiting';
}

function refuse(code: string, message: string): never {
  throw new MutationError(code, message);
}

function requireOver(game: MultiplayerGame): void {
  if (game.outcome === 'aborted')
    refuse(
      'CHESS_NO_REMATCH_AFTER_ABORT',
      'An aborted multiplayer game has no multiplayer rematch.'
    );
  if (!isFinished(game.outcome))
    refuse('CHESS_GAME_NOT_OVER', 'The multiplayer game is not over yet.');
}

function requireWaitingOffer(game: MultiplayerGame, actorId: string): void {
  if (game.rematch_offer_by === actorId)
    refuse(
      'CHESS_OWN_REMATCH_OFFER',
      'Only your multiplayer opponent may answer your multiplayer rematch offer.'
    );
  if (game.rematch_offer_by !== otherPerson(game, actorId))
    refuse('CHESS_REMATCH_ENDED', 'The multiplayer rematch offer has ended.');
}

/** Neither person may be looking for an opponent or have moved on to another game. */
async function requireBothFree(
  tx: SqlTx,
  game: MultiplayerGame,
  people: { readonly actorId: string; readonly nowMs: number }
): Promise<void> {
  const other = otherPerson(game, people.actorId);
  if (await looking(tx, people.actorId, people.nowMs))
    refuse('CHESS_ALREADY_LOOKING', 'You are already looking for an opponent.');
  if ((await currentGameOf(tx, other)) !== game.id)
    refuse(
      'CHESS_OPPONENT_PLAYING',
      'Your multiplayer opponent is already playing another multiplayer game.'
    );
  if (await looking(tx, other, people.nowMs))
    refuse(
      'CHESS_OPPONENT_LOOKING',
      'Your multiplayer opponent is already looking for an opponent.'
    );
  if ((await currentGameOf(tx, people.actorId)) !== game.id)
    refuse('CHESS_REMATCH_ENDED', 'The multiplayer rematch offer has ended.');
}

/** The same two people at the same time control, colours swapped, no search. */
async function startRematch(
  ctx: MutationCtx,
  game: MultiplayerGame,
  nowMs: number
): Promise<MultiplayerGame> {
  const rules = requireTurnGames(ctx.env);
  if (!rules.offers(rules.forPosition(game.fen).id, 'matchmaking'))
    throw new MutationError(
      'CHESS_TIME_CONTROL_NOT_OFFERED',
      'The game no longer offers finding an opponent.'
    );
  await createMultiplayerGame(
    ctx.tx,
    {
      id: `rematch:${game.id}`,
      whiteId: game.black_id,
      blackId: game.white_id,
      timeControl: game.time_control ?? '',
      rematchOf: game.id,
      nowMs,
      createId: ctx.env.createId,
    },
    rules
  );
  return { ...game, rematch_offer_by: '' };
}

async function decideRematch(
  ctx: MutationCtx,
  game: MultiplayerGame,
  answer: RematchAnswer,
  nowMs: number
): Promise<MultiplayerGame> {
  const actorId = ctx.env.actorId;
  if (answer === 'offer') requireOver(game);
  else if (!isFinished(game.outcome)) requireOver(game);
  else requireWaitingOffer(game, actorId);
  if (answer === 'decline') return { ...game, rematch_offer_by: '' };
  await requireBothFree(ctx.tx, game, { actorId, nowMs });
  if (
    answer === 'accept' ||
    game.rematch_offer_by === otherPerson(game, actorId)
  )
    return startRematch(ctx, game, nowMs);
  return { ...game, rematch_offer_by: actorId };
}

/** Offer, accept or decline a rematch of the person's finished game. */
export async function answerRematch(
  ctx: MutationCtx,
  args: { readonly gameId: string; readonly answer: RematchAnswer }
): Promise<void> {
  await requireInMutation(ctx, PERMISSION.gameMultiplayerPlay);
  const serverNow = ctx.env.serverNow;
  if (serverNow === undefined) return;
  const nowMs = serverNow().getTime();
  const repository = new MultiplayerGameRepository(ctx.tx);
  const game = await repository.owned(args.gameId, ctx.env.actorId, nowMs);
  const next = await decideRematch(ctx, game, args.answer, nowMs);
  await repository.save(game, next, nowMs, { server: true, publish: ctx.env });
}
