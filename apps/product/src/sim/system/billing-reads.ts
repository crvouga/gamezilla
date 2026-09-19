/**
 * Reads for the billing scenarios: the on-screen tier, which billing button is
 * offered, and the projection rows on the actor's client and the server.
 */
import { Handles } from '@libs/test-ids';
import { sql } from '@pkgs/sql';

import { actorUi } from './actor-ui';
import { nodeText } from './observations';
import type { ProductSim } from './sim';

/** The primary auth provider slug the auth snapshot writes (`idp`). */
const IDP_PROVIDER = 'idp';

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
  which: 'subscribe' | 'manage'
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const handle =
    which === 'subscribe' ? Handles.billingSubscribe : Handles.billingManage;
  return await ui.get(handle).isVisible();
}

export async function membershipRow(
  s: ProductSim,
  actorId: string
): Promise<MembershipRowView | null> {
  const handle = s.sim.clientSql(actorId);
  if (handle === undefined) return null;
  const rows = await handle.sqlClient.query(sql<MembershipRowRaw>`
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
  const handle = s.sim.clientSql(actorId);
  if (handle === undefined) return [];
  const rows = await handle.sqlClient.query(sql<MembershipRowRaw>`
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

/**
 * The actor's signed-in account id, or `null` while signed out. Read from the
 * synced `auth_external_accounts` row the client already trusts.
 */
export async function accountIdOf(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const handle = s.sim.clientSql(actorId);
  if (handle === undefined) return null;
  const rows = await handle.sqlClient.query(sql<{ readonly user_id: string }>`
    SELECT user_id
    FROM auth_external_accounts
    WHERE provider = ${IDP_PROVIDER}
    LIMIT 1`);
  return rows[0]?.user_id ?? null;
}
