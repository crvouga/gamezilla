import type { Decision } from '@pkgs/permissions';
import { sql } from '@pkgs/sql';
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
import type {
  AppGrantKey,
  AppLimit,
  AppQuota,
} from '../shared/permission-catalog';
import { evaluateQuota } from '../use-cases/consume-quota/shared/evaluate-quota';

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

/**
 * Refusal code for a limited quota's result whose action was never charged:
 * the client skipped (or lost) the consume that should have preceded it.
 */
export const QUOTA_NOT_CHARGED = 'quota_not_charged';

type KeyRow = { readonly idempotency_key: unknown };

/**
 * Whether the actor holds a live charge of `quota` whose idempotency key
 * starts with `keyPrefix`. Filtered in code: a SQL `LIKE` would read `_` and
 * `%` in ids as wildcards.
 */
async function hasCharge(
  ctx: MutationCtx,
  args: { readonly quota: AppQuota; readonly keyPrefix: string }
): Promise<boolean> {
  const rows = await ctx.tx.query<KeyRow>(sql<KeyRow>`
    SELECT idempotency_key FROM permissions_quota_ledger
    WHERE owner_id = ${ctx.env.actorId}
      AND quota = ${args.quota}
      AND deleted_at IS NULL
  `);
  return rows.some(
    (row) =>
      typeof row.idempotency_key === 'string' &&
      row.idempotency_key.startsWith(args.keyPrefix)
  );
}

/**
 * Guards the result of a quota-charged action (a rated puzzle's result, whose
 * start consumed the quota): passes when the actor's quota is unlimited, or
 * when a charge keyed `keyPrefix…` exists (on any day: an action started
 * before its window reset still finishes). Otherwise throws a permanent
 * `MutationError`: the quota decision's reason (meta = the decision) when one
 * more is refused now, else {@link QUOTA_NOT_CHARGED}.
 *
 * Charges nothing itself: the window of a charge is the server's clock, which
 * only the replay's authorize hook sees (`consumeQuota`); a presence check
 * does not depend on the clock.
 */
export async function requireChargedInMutation(
  ctx: MutationCtx,
  args: { readonly quota: AppQuota; readonly keyPrefix: string }
): Promise<void> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  const decision = await evaluateQuota(ctx.tx, {
    identity: ctx.env,
    quota: args.quota,
    nowMs,
    clientAtMs: Math.min(ctx.env.now().getTime(), nowMs),
    amount: 1,
  });
  if (decision.allowed && decision.limit === undefined) return;
  if (await hasCharge(ctx, args)) return;
  if (!decision.allowed) {
    throw new MutationError(
      decision.reason ?? 'not_granted',
      `Quota ${args.quota} denied.`,
      { decision }
    );
  }
  throw new MutationError(
    QUOTA_NOT_CHARGED,
    `Quota ${args.quota} was not charged for this result.`
  );
}
