/**
 * Reads for the billing scenarios: what the billing screen shows (tier,
 * membership state and date, current plan, which button is offered), and the
 * projection rows on the actor's client and the server for code tests.
 */

import { MembershipRepository } from '@libs/billing-shared-ts/membership-repository';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorLocalSql } from '@libs/harness-ts/identity';
import { actorHtml, nodeText } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

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
  s: ProductHarness,
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

/** Plus credit on the billing screen, in cents. Absent line means none. */
function creditCentsIn(html: string): number {
  const tag = openingTag(html, Handles.billingCredit);
  if (tag === null) return 0;
  const parsed = Number(attribute(tag, 'data-credit-cents'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The membership as the billing screen shows it. */
export type MembershipShown = {
  /** `none` | `incomplete` | `trialing` | `active` | `canceling` | `delinquent` | `ended`. */
  readonly state: string;
  /** The date the status line names (trial end, renewal, end), in ms. */
  readonly periodEndMs: number | null;
  /** The last day of paid access the status line tells, in ms, if any. */
  readonly accessEndMs: number | null;
  /** Plus credit the screen shows, in cents. `0` when the line is absent. */
  readonly creditCents: number;
};

/** The billing screen's status line, or `null` while it is not on screen. */
export async function membershipShown(
  s: ProductHarness,
  actorId: string
): Promise<MembershipShown | null> {
  const html = await actorHtml(s, actorId);
  const tag = html === null ? null : openingTag(html, Handles.billingStatus);
  if (html === null || tag === null) return null;
  const end = attribute(tag, 'data-period-end');
  const accessEnd = attribute(tag, 'data-access-end');
  return {
    state: attribute(tag, 'data-state') ?? 'none',
    periodEndMs: end === null ? null : Date.parse(end),
    accessEndMs: accessEnd === null ? null : Date.parse(accessEnd),
    creditCents: creditCentsIn(html),
  };
}

/** The offer price the billing screen marks as the current plan, if any. */
export async function currentPlan(
  s: ProductHarness,
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

/**
 * Which notice the billing screen shows (`offline`, `delinquent`,
 * `incomplete`, `unavailable`, `confirming`, `unconfirmed`), or `null` for
 * none.
 */
export async function billingNotice(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const html = await actorHtml(s, actorId);
  const tag = html === null ? null : openingTag(html, Handles.billingNotice);
  return tag === null ? null : attribute(tag, 'data-notice');
}

export async function billingButtonVisible(
  s: ProductHarness,
  actorId: string,
  which: 'subscribe' | 'manage' | 'unlock' | 'checkAgain'
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const handle = {
    subscribe: Handles.billingSubscribe,
    manage: Handles.billingManage,
    unlock: Handles.billingUnlock,
    checkAgain: Handles.billingCheckAgain,
  }[which];
  return await ui.get(handle).isVisible();
}

/**
 * Whether the billing screen's `which` button is on screen and accepts a
 * press. A mutation button stays disabled on its "Opening…" face for a moment
 * after it opened the provider's page, so a person coming straight back waits
 * for it before pressing again.
 */
export async function billingButtonEnabled(
  s: ProductHarness,
  actorId: string,
  which: 'subscribe' | 'manage'
): Promise<boolean> {
  const html = await actorHtml(s, actorId);
  const handle = {
    subscribe: Handles.billingSubscribe,
    manage: Handles.billingManage,
  }[which];
  const tag = html === null ? null : openingTag(html, handle);
  return tag !== null && !/\sdisabled(?:[\s=>]|$)/.test(tag);
}

/**
 * The face the billing screen's subscribe button shows (`idle`, `loading`,
 * `success`, `error`), or `null` while it is not on screen.
 */
export async function subscribeButtonPhase(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const html = await actorHtml(s, actorId);
  const tag = html === null ? null : openingTag(html, Handles.billingSubscribe);
  return tag === null ? null : attribute(tag, 'data-phase');
}

export async function membershipRow(
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  accountId: string
): Promise<MembershipRowView | null> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<MembershipRowRaw>`
    SELECT status, price_key, current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${accountId} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1`);
  return normalizeRow(rows[0]);
}

/** Live membership rows on the server across every account. */
export async function serverMembershipCount(
  s: ProductHarness
): Promise<number> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
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
  s: ProductHarness,
  accountId: string
): Promise<readonly MembershipRecord[]> {
  return await recordsIn(s.harness.serverSql.sqlClient, accountId);
}

/** Every membership of the account the actor's device holds, oldest first. */
export async function deviceMemberships(
  s: ProductHarness,
  actorId: string,
  accountId: string
): Promise<readonly MembershipRecord[]> {
  const local = actorLocalSql(s, actorId);
  return local === null ? [] : await recordsIn(local, accountId);
}

/**
 * The provider whose page the actor's browser shows (a hosted checkout or
 * billing portal), by the id the app knows it by; `null` while the actor is
 * in the app or on some other page.
 */
export function providerPageShown(
  s: ProductHarness,
  actorId: string
): string | null {
  const address = s.harness.browser(actorId).address();
  if (address === null) return null;
  return s.harness.billing?.at(address)?.id ?? null;
}

/** The provider new checkouts go to, by id. */
export function checkoutProvider(s: ProductHarness): string {
  const providers = s.harness.billing;
  if (providers === null) throw new Error('billing: no payment provider');
  return providers.checkout().id;
}

/** The membership that governs an account's access, as the server holds it. */
export type GoverningMembership = {
  /** The provider holding it. */
  readonly provider: string;
  readonly status: string | null;
};

/**
 * The account's governing membership — a live one wherever it is, else its
 * newest — or `null` before it ever subscribed.
 */
export async function governingMembership(
  s: ProductHarness,
  accountId: string
): Promise<GoverningMembership | null> {
  const row = await new MembershipRepository(
    s.harness.serverSql.sqlClient
  ).governing(accountId);
  return row === null ? null : { provider: row.provider, status: row.status };
}
