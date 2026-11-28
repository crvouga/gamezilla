import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type {
  MutationDb,
  MutationEnv,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { decideLimitForActor } from './decide-for-actor';
import { LIMIT } from './permission-catalog';

/** What a person holds when they ask for another multiplayer game. */
export type UnfinishedGames = {
  readonly multiplayer: number;
  /** Active Game Sessions the person is a participant of. */
  readonly gameSessions: number;
};

/**
 * `specs/games/unfinished-game-limit.dmn`: the unfinished matched game
 * limit decides first; within it, a participant of a game session under way
 * must finish that game before seeking another (`restricted`, with its own
 * unlock copy under the same limit).
 */
export function decideUnfinishedGames(
  limitDecision: Decision,
  gameSessions: number
): Decision {
  if (!limitDecision.allowed || gameSessions < 1) return limitDecision;
  return {
    allowed: false,
    reason: 'restricted',
    unlockRef: `${LIMIT.unfinishedMultiplayerGames}#restricted`,
    policyVersion: limitDecision.policyVersion,
  };
}

/** What the person is offered in place of seeking, as the limit decides. */
export type UnfinishedGamesOffer =
  | 'seek an opponent'
  | 'return to their matched game'
  | 'return to the game session';

/**
 * `specs/games/unfinished-game-limit.dmn`'s offer: seeking an opponent when
 * the limit allows it; otherwise returning to the game the person must
 * finish first, never a dead end.
 */
export function unfinishedGamesOffer(decision: Decision): UnfinishedGamesOffer {
  if (decision.allowed) return 'seek an opponent';
  return decision.reason === 'restricted'
    ? 'return to the game session'
    : 'return to their matched game';
}

/**
 * Throws a permanent `MutationError` (code = the denial reason, meta = the
 * decision) when the actor may not seek another multiplayer game.
 */
export async function requireUnfinishedGamesInMutation(
  ctx: { readonly tx: MutationDb; readonly env: MutationEnv },
  held: UnfinishedGames
): Promise<void> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  const decision = decideUnfinishedGames(
    await decideLimitForActor(ctx.tx, {
      identity: ctx.env,
      limit: LIMIT.unfinishedMultiplayerGames,
      used: held.multiplayer,
      nowMs,
      clientAtMs: Math.min(ctx.env.now().getTime(), nowMs),
    }),
    held.gameSessions
  );
  if (decision.allowed) return;
  throw new MutationError(
    decision.reason ?? 'limit_reached',
    `Limit reached: ${LIMIT.unfinishedMultiplayerGames}`,
    { decision }
  );
}
