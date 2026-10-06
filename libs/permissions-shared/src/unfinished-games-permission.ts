import type { Decision } from '@pkgs/permissions-shared/decision';
import type {
  MutationDb,
  MutationEnv,
} from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { decideLimitForActor } from './decide-for-actor';
import { LIMIT } from './permission-catalog';

/** What a person holds when they ask for another multiplayer game. */
export type UnfinishedGames = {
  readonly multiplayer: number;
  /** Active Custom Games the person is a participant of. */
  readonly customGames: number;
};

/**
 * `specs/chess/unfinished-game-limit.dmn`: the unfinished multiplayer game
 * limit decides first; within it, a participant of an active Custom Game must
 * finish that game before seeking another (`restricted`, with its own unlock
 * copy under the same limit).
 */
export function decideUnfinishedGames(
  limitDecision: Decision,
  customGames: number
): Decision {
  if (!limitDecision.allowed || customGames < 1) return limitDecision;
  return {
    allowed: false,
    reason: 'restricted',
    unlockRef: `${LIMIT.unfinishedMultiplayerGames}#restricted`,
    policyVersion: limitDecision.policyVersion,
  };
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
    held.customGames
  );
  if (decision.allowed) return;
  throw new MutationError(
    decision.reason ?? 'limit_reached',
    `Limit reached: ${LIMIT.unfinishedMultiplayerGames}`,
    { decision }
  );
}
