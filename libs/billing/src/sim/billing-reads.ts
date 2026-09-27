/**
 * Reads for the billing scenarios: what the billing screen shows (tier,
 * membership state and date, current plan, which button is offered), and the
 * projection rows on the actor's client and the server for code tests.
 */

import { actorUi } from '@libs/sim-harness/system/actor-ui';
import { actorLocalSql } from '@libs/sim-harness/system/identity';
import { actorHtml, nodeText } from '@libs/sim-harness/system/observations';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';
import { sql } from '@pkgs/sql';

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

/** The opening tag of the element with `testId` in `html`, or `null`. */
function openingTag(html: string, testId: string): string | null {
  const match = new RegExp(`<[^>]*\\sdata-testid="${testId}"[^>]*>`).exec(html);
  return match?.[0] ?? null;
}

function attribute(tag: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

/** The membership as the billing screen shows it. */
export type MembershipShown = {
  /** `none` | `incomplete` | `trialing` | `active` | `canceling` | `delinquent` | `ended`. */
  readonly state: string;
  /** The date the status line names (trial end, renewal, access end), in ms. */
  readonly periodEndMs: number | null;
};

/** The billing screen's status line, or `null` while it is not on screen. */
export async function membershipShown(
  s: ProductSim,
  actorId: string
): Promise<MembershipShown | null> {
  const html = await actorHtml(s, actorId);
  const tag = html === null ? null : openingTag(html, Handles.billingStatus);
  if (tag === null) return null;
  const end = attribute(tag, 'data-period-end');
  return {
    state: attribute(tag, 'data-state') ?? 'none',
    periodEndMs: end === null ? null : Date.parse(end),
  };
}

/** The offer price the billing screen marks as the current plan, if any. */
export async function currentPlan(
  s: ProductSim,
  actorId: string,
  priceKeys: readonly string[]
): Promise<string | null> {
  const html = await actorHtml(s, actorId);
  if (html === null) return null;
  for (const key of priceKeys) {
    const tag = openingTag(html, Handles.billingPrice(key));
    if (tag !== null && attribute(tag, 'aria-current') === 'true') return key;
  }
  return null;
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
