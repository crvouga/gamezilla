/**
 * Reads for the billing scenarios: the on-screen tier, which billing button is
 * offered, and the projection rows on the actor's client and the server.
 */

import { actorUi } from '@libs/sim-harness/system/actor-ui';
import { actorLocalSql } from '@libs/sim-harness/system/identity';
import { nodeText } from '@libs/sim-harness/system/observations';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

/** Raw row shape; `cancel_at_period_end` is 0/1 on SQLite and a bool on PG. */
type MembershipRowRaw = {
  readonly status: string;
  readonly price_key: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

export type MembershipRowView = {
  readonly status: string;
  readonly price_key: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number;
};

function normalizeRow(
  row: MembershipRowRaw | undefined
): MembershipRowView | null {
  if (row === undefined) return null;
  return {
    status: row.status,
    price_key: row.price_key,
    current_period_end: row.current_period_end,
    cancel_at_period_end:
      row.cancel_at_period_end === true || row.cancel_at_period_end === 1
        ? 1
        : 0,
  };
}

export async function billingTier(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  return await nodeText(s, actorId, [Handles.billingTier]);
}

export async function billingButtonVisible(
  s: ProductSim,
  actorId: string,
  which: 'subscribe' | 'manage' | 'unlock'
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const handle = {
    subscribe: Handles.billingSubscribe,
    manage: Handles.billingManage,
    unlock: Handles.billingUnlock,
  }[which];
  return await ui.get(handle).isVisible();
}

export async function membershipRow(
  s: ProductSim,
  actorId: string
): Promise<MembershipRowView | null> {
  const local = actorLocalSql(s, actorId);
  if (local === null) return null;
  const rows = await local.query(sql<MembershipRowRaw>`
    SELECT status, price_key, current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1`);
  return normalizeRow(rows[0]);
}

/** Every live projection row for the actor (a resubscribe leaves history). */
export async function membershipRows(
  s: ProductSim,
  actorId: string
): Promise<readonly MembershipRowView[]> {
  const local = actorLocalSql(s, actorId);
  if (local === null) return [];
  const rows = await local.query(sql<MembershipRowRaw>`
    SELECT status, price_key, current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE deleted_at IS NULL
    ORDER BY created_at ASC`);
  return rows.flatMap((row) => {
    const view = normalizeRow(row);
    return view === null ? [] : [view];
  });
}

export async function serverMembershipRow(
  s: ProductSim,
  accountId: string
): Promise<MembershipRowView | null> {
  const rows = await s.sim.serverSql.sqlClient.query(sql<MembershipRowRaw>`
    SELECT status, price_key, current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${accountId} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1`);
  return normalizeRow(rows[0]);
}

/** Live membership rows on the server across every account. */
export async function serverMembershipCount(s: ProductSim): Promise<number> {
  const rows = await s.sim.serverSql.sqlClient.query(sql<{
    readonly n: number | string;
  }>`
    SELECT COUNT(*) AS n
    FROM billing_subscriptions
    WHERE deleted_at IS NULL`);
  return Number(rows[0]?.n ?? 0);
}

/** One membership as a person could tell it apart: its full synced row. */
export type MembershipRecord = {
  readonly subscriptionId: string;
  readonly status: string;
  readonly priceKey: string | null;
  readonly currentPeriodEndMs: number | null;
  readonly cancelAtPeriodEnd: boolean;
};

type MembershipRecordRaw = MembershipRowRaw & {
  readonly provider_subscription_id: string;
};

async function recordsIn(
  db: SqlTx,
  accountId: string
): Promise<readonly MembershipRecord[]> {
  const rows = await db.query(sql<MembershipRecordRaw>`
    SELECT provider_subscription_id, status, price_key, current_period_end,
      cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${accountId} AND deleted_at IS NULL
    ORDER BY created_at ASC, provider_subscription_id ASC`);
  return rows.map((row) => ({
    subscriptionId: row.provider_subscription_id,
    status: row.status,
    priceKey: row.price_key,
    currentPeriodEndMs:
      row.current_period_end === null
        ? null
        : Date.parse(row.current_period_end),
    cancelAtPeriodEnd:
      row.cancel_at_period_end === true || row.cancel_at_period_end === 1,
  }));
}

/** Every membership the server holds for the account, oldest first. */
export async function serverMemberships(
  s: ProductSim,
  accountId: string
): Promise<readonly MembershipRecord[]> {
  return await recordsIn(s.sim.serverSql.sqlClient, accountId);
}

/** Every membership of the account the actor's device holds, oldest first. */
export async function deviceMemberships(
  s: ProductSim,
  actorId: string,
  accountId: string
): Promise<readonly MembershipRecord[]> {
  const local = actorLocalSql(s, actorId);
  return local === null ? [] : await recordsIn(local, accountId);
}
