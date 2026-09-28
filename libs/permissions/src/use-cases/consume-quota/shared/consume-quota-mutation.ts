import type { Decision } from '@pkgs/permissions';
import { sql } from '@pkgs/sql';
import {
  defineMutation,
  type MutationDb,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { QUOTA_ACTIONS } from '../../../shared/permission-catalog';
import type { AccessIdentity } from '../../../shared/read-access';
import { evaluateQuota } from './evaluate-quota';

/** Max key length: attempt / run ids, never payloads. */
const MAX_KEY_LENGTH = 200;

export const consumeQuotaArgs = z.object({
  /** Ledger row id minted by the caller so local and server rows agree. */
  id: z.string().min(1).max(MAX_KEY_LENGTH),
  quota: z.enum(QUOTA_ACTIONS),
  idempotencyKey: z.string().min(1).max(MAX_KEY_LENGTH),
  amount: z.number().int().min(1).max(100).default(1),
});

export type ConsumeQuotaArgs = z.output<typeof consumeQuotaArgs>;

type KeyRow = { readonly id: string };

/** Denials carry the whole decision so the client can render it. */
export type QuotaDenialMeta = { readonly decision: Decision };

async function keyAlreadyConsumed(
  tx: MutationDb,
  ownerId: string,
  key: string
): Promise<boolean> {
  const rows = await tx.query<KeyRow>(sql<KeyRow>`
    SELECT id FROM permissions_quota_ledger
    WHERE owner_id = ${ownerId} AND idempotency_key = ${key}
  `);
  return rows.length > 0;
}

/** When a consume is evaluated: window clock and policy-version clock. */
export type ConsumeClock = {
  readonly nowMs: number;
  readonly clientAtMs: number;
};

/**
 * The one consume (§22.4), shared by the optimistic local apply and the
 * server's replay guard. Idempotent on (owner, key): an existing key is a
 * no-op. Otherwise evaluates the quota under the synced policy and facts and
 * appends a ledger row stamped `clock.nowMs`; a denial is a permanent
 * `MutationError` whose code is the reason and whose meta is the decision.
 */
export async function applyConsume(
  tx: MutationDb,
  identity: AccessIdentity,
  args: ConsumeQuotaArgs,
  clock: ConsumeClock
): Promise<void> {
  const ownerId = identity.actorId;
  if (await keyAlreadyConsumed(tx, ownerId, args.idempotencyKey)) return;
  const decision = await evaluateQuota(tx, {
    identity,
    quota: args.quota,
    nowMs: clock.nowMs,
    clientAtMs: clock.clientAtMs,
    amount: args.amount,
  });
  if (!decision.allowed) {
    const meta: QuotaDenialMeta = { decision };
    throw new MutationError(
      decision.reason ?? 'not_granted',
      `Quota ${args.quota} denied.`,
      meta
    );
  }
  await tx.run(sql`
    INSERT INTO permissions_quota_ledger (
      id, owner_id, quota, idempotency_key, amount, consumed_at,
      policy_version
    )
    VALUES (
      ${args.id}, ${ownerId}, ${args.quota}, ${args.idempotencyKey},
      ${args.amount}, ${new Date(clock.nowMs).toISOString()},
      ${decision.policyVersion}
    )
  `);
}

/**
 * Local apply: device clock (a hint). On server replay the host's guard has
 * already consumed this key with server time (`authorizeAppMutation`), so the
 * body is a no-op there; the harness's replay passes `serverNow`.
 */
export const consumeQuotaMutation = defineMutation({
  name: 'consumeQuota',
  args: consumeQuotaArgs,
  async run({ tx, env }, args) {
    const nowMs = (env.serverNow ?? env.now)().getTime();
    await applyConsume(tx, env, args, {
      nowMs,
      clientAtMs: Math.min(env.now().getTime(), nowMs),
    });
  },
});
