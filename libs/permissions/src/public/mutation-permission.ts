import type { Decision } from '@pkgs/permissions';
import {
  type MutationDb,
  type MutationEnv,
  MutationError,
} from '@pkgs/sync-engine/shared';

import {
  type AccessScope,
  decideForActor,
  decideLimitForActor,
} from '../shared/decide-for-actor';
import type { AppGrantKey, AppLimit } from '../shared/permission-catalog';

export type { AccessScope };

type MutationCtx = { readonly tx: MutationDb; readonly env: MutationEnv };

/**
 * The actor's decision for `key` inside a mutation body. Reads the same synced
 * rows on the optimistic local apply and the server replay, so a mutation
 * body gates exactly as the server's authorize hook does — never on the
 * actor's sign-in state or plan, which a body does not see.
 */
export async function decideInMutation(
  ctx: MutationCtx,
  key: AppGrantKey,
  scope?: AccessScope
): Promise<Decision> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  return decideForActor(ctx.tx, {
    identity: ctx.env,
    key,
    nowMs,
    clientAtMs: Math.min(ctx.env.now().getTime(), nowMs),
    scope,
  });
}

/**
 * Throws a permanent `MutationError` (code = the denial reason, meta = the
 * decision) when the actor may not `key`.
 */
export async function requireInMutation(
  ctx: MutationCtx,
  key: AppGrantKey,
  scope?: AccessScope
): Promise<void> {
  const decision = await decideInMutation(ctx, key, scope);
  if (decision.allowed) return;
  throw new MutationError(
    decision.reason ?? 'not_granted',
    `Permission denied: ${key}`,
    { decision }
  );
}

/**
 * Throws a permanent `MutationError` (code `limit_reached`, meta = the
 * decision) when the actor, holding `used` of `limit`, may not hold one more.
 * Same synced rows on the optimistic apply and the server replay, so a device
 * offline and the server give the same answer.
 */
export async function requireLimitInMutation(
  ctx: MutationCtx,
  limit: AppLimit,
  used: number
): Promise<void> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  const decision = await decideLimitForActor(ctx.tx, {
    identity: ctx.env,
    limit,
    used,
    nowMs,
    clientAtMs: Math.min(ctx.env.now().getTime(), nowMs),
  });
  if (decision.allowed) return;
  throw new MutationError(
    decision.reason ?? 'limit_reached',
    `Limit reached: ${limit}`,
    { decision }
  );
}
