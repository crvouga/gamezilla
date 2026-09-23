import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import { managedInsertColumns } from '@libs/auth/public/managed-row';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

type SubscriptionRow = {
  readonly id: string;
  readonly status: string;
  readonly price_key: string | null;
  readonly customer_id: string | null;
  readonly subscription_id: string | null;
  readonly trial_end: string | null;
  readonly current_period_end: string | null;
  readonly grace_until: string | null;
  readonly cancel_at_period_end: boolean | number | null;
};

export type BillingEventResult = 'applied' | 'duplicate' | 'rejected';

function isoFromSeconds(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function record(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function accountForCustomer(
  sqlClient: SqlClient,
  customerId: string,
  metadataAccountId: string | null
): Promise<string | null | 'mismatch'> {
  const bound = await new ExternalAccountRepository(
    sqlClient
  ).findUserIdByProviderExternalId(
    EXTERNAL_ACCOUNT_PROVIDER_BILLING,
    customerId
  );
  if (bound === null) return null;
  if (metadataAccountId !== null && metadataAccountId !== bound)
    return 'mismatch';
  return bound;
}

async function readSubscription(
  sqlClient: SqlClient,
  accountId: string
): Promise<SubscriptionRow | null> {
  const rows = await sqlClient.query<SubscriptionRow>(sql`
    SELECT id, status, price_key, customer_id, subscription_id, trial_end,
      current_period_end, grace_until, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${accountId} AND deleted_at IS NULL
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function writeSubscription(
  sqlClient: SqlClient,
  createId: CreateId,
  now: () => number,
  row: {
    readonly accountId: string;
    readonly status: string;
    readonly priceKey: string | null;
    readonly customerId: string;
    readonly subscriptionId: string | null;
    readonly trialEnd: string | null;
    readonly periodEnd: string | null;
    readonly graceUntil: string | null;
    readonly cancelAtPeriodEnd: boolean;
  }
): Promise<void> {
  const existing = await readSubscription(sqlClient, row.accountId);
  const managed = managedInsertColumns(createId, now, existing?.id);
  await sqlClient.run(sql`
    INSERT INTO billing_subscriptions (
      id, created_at, updated_at, account_id, status, price_key, customer_id,
      subscription_id, trial_end, current_period_end, grace_until,
      cancel_at_period_end, action_required
    )
    VALUES (
      ${managed.id}, ${managed.created_at}, ${managed.updated_at},
      ${row.accountId}, ${row.status}, ${row.priceKey}, ${row.customerId},
      ${row.subscriptionId}, ${row.trialEnd}, ${row.periodEnd}, ${row.graceUntil},
      ${row.cancelAtPeriodEnd}, ${false}
    )
    ON CONFLICT (account_id) DO UPDATE SET
      status = excluded.status,
      price_key = COALESCE(excluded.price_key, billing_subscriptions.price_key),
      customer_id = excluded.customer_id,
      subscription_id = COALESCE(excluded.subscription_id, billing_subscriptions.subscription_id),
      trial_end = excluded.trial_end,
      current_period_end = COALESCE(excluded.current_period_end, billing_subscriptions.current_period_end),
      grace_until = excluded.grace_until,
      cancel_at_period_end = excluded.cancel_at_period_end,
      action_required = excluded.action_required,
      updated_at = excluded.updated_at
  `);
}

function priceKeyOf(object: Record<string, unknown>): string | null {
  const items = record(object['items']);
  const data = items?.['data'];
  if (!Array.isArray(data)) return null;
  const first = record(data[0]);
  const price = record(first?.['price']);
  return text(price?.['lookup_key']);
}

export async function seenEvent(
  sqlClient: SqlClient,
  eventId: string
): Promise<boolean> {
  const rows = await sqlClient.query<{ id: string }>(sql`
    SELECT id FROM billing_events WHERE event_id = ${eventId} LIMIT 1
  `);
  return rows.length > 0;
}

export async function rememberEvent(
  sqlClient: SqlClient,
  createId: CreateId,
  now: () => number,
  eventId: string
): Promise<void> {
  const managed = managedInsertColumns(createId, now);
  await sqlClient.run(sql`
    INSERT INTO billing_events (id, created_at, updated_at, event_id)
    VALUES (${managed.id}, ${managed.created_at}, ${managed.updated_at}, ${eventId})
  `);
}

export async function applyBillingEvent(args: {
  readonly sqlClient: SqlClient;
  readonly createId: CreateId;
  readonly now: () => number;
  readonly event: Record<string, unknown>;
}): Promise<BillingEventResult> {
  const eventId = text(args.event['id']);
  const type = text(args.event['type']);
  const data = record(args.event['data']);
  const object = record(data?.['object']);
  if (eventId === null || type === null || object === null) return 'rejected';
  if (await seenEvent(args.sqlClient, eventId)) return 'duplicate';
  const created = args.event['created'];
  const createdMs = typeof created === 'number' ? created * 1000 : args.now();
  const outcome = await applyObject({
    ...args,
    type,
    object,
    createdMs,
  });
  if (outcome === 'rejected') return 'rejected';
  await rememberEvent(args.sqlClient, args.createId, args.now, eventId);
  return 'applied';
}

async function applyObject(args: {
  readonly sqlClient: SqlClient;
  readonly createId: CreateId;
  readonly now: () => number;
  readonly type: string;
  readonly object: Record<string, unknown>;
  readonly createdMs: number;
}): Promise<'applied' | 'rejected'> {
  if (args.type === 'checkout.session.completed') {
    return bindCheckout(args.sqlClient, args.createId, args.now, args.object);
  }
  const customerId = text(args.object['customer']);
  if (customerId === null) return 'rejected';
  const metadata = record(args.object['metadata']);
  const account = await accountForCustomer(
    args.sqlClient,
    customerId,
    text(metadata?.['accountId'])
  );
  if (account === 'mismatch' || account === null) return 'rejected';
  if (args.type === 'invoice.payment_failed') {
    return markPastDue(args, account, customerId);
  }
  if (args.type === 'invoice.payment_succeeded') {
    return markPaid(args, account, customerId);
  }
  if (args.type === 'customer.subscription.updated') {
    return applySubscription(args, account, customerId);
  }
  return 'applied';
}

async function bindCheckout(
  sqlClient: SqlClient,
  createId: CreateId,
  now: () => number,
  object: Record<string, unknown>
): Promise<'applied' | 'rejected'> {
  const accountId = text(object['client_reference_id']);
  const customerId = text(object['customer']);
  if (accountId === null || customerId === null) return 'rejected';
  const bound = await accountForCustomer(sqlClient, customerId, accountId);
  if (bound === 'mismatch') return 'rejected';
  await new ExternalAccountRepository(sqlClient).insertExternalAccountOrGet({
    userId: accountId,
    provider: EXTERNAL_ACCOUNT_PROVIDER_BILLING,
    externalId: customerId,
    now,
    createId,
  });
  return 'applied';
}

async function markPastDue(
  args: {
    readonly sqlClient: SqlClient;
    readonly createId: CreateId;
    readonly now: () => number;
    readonly createdMs: number;
  },
  accountId: string,
  customerId: string
): Promise<'applied'> {
  const existing = await readSubscription(args.sqlClient, accountId);
  const grace =
    existing?.grace_until ?? new Date(args.createdMs + GRACE_MS).toISOString();
  await writeSubscription(args.sqlClient, args.createId, args.now, {
    accountId,
    status: 'past_due',
    priceKey: existing?.price_key ?? null,
    customerId,
    subscriptionId: existing?.subscription_id ?? null,
    trialEnd: existing?.trial_end ?? null,
    periodEnd: existing?.current_period_end ?? null,
    graceUntil: grace,
    cancelAtPeriodEnd: false,
  });
  return 'applied';
}

async function markPaid(
  args: {
    readonly sqlClient: SqlClient;
    readonly createId: CreateId;
    readonly now: () => number;
    readonly object: Record<string, unknown>;
  },
  accountId: string,
  customerId: string
): Promise<'applied'> {
  const existing = await readSubscription(args.sqlClient, accountId);
  await writeSubscription(args.sqlClient, args.createId, args.now, {
    accountId,
    status: 'active',
    priceKey: existing?.price_key ?? null,
    customerId,
    subscriptionId: existing?.subscription_id ?? null,
    trialEnd: existing?.trial_end ?? null,
    periodEnd:
      isoFromSeconds(args.object['period_end']) ??
      existing?.current_period_end ??
      null,
    graceUntil: null,
    cancelAtPeriodEnd: false,
  });
  return 'applied';
}

async function applySubscription(
  args: {
    readonly sqlClient: SqlClient;
    readonly createId: CreateId;
    readonly now: () => number;
    readonly object: Record<string, unknown>;
    readonly createdMs: number;
  },
  accountId: string,
  customerId: string
): Promise<'applied'> {
  const existing = await readSubscription(args.sqlClient, accountId);
  const status = text(args.object['status']) ?? 'incomplete';
  let grace = existing?.grace_until ?? null;
  if (status === 'active' || status === 'trialing') grace = null;
  if (status === 'past_due' && grace === null) {
    grace = new Date(args.createdMs + GRACE_MS).toISOString();
  }
  await writeSubscription(args.sqlClient, args.createId, args.now, {
    accountId,
    status,
    priceKey: priceKeyOf(args.object) ?? existing?.price_key ?? null,
    customerId,
    subscriptionId:
      text(args.object['id']) ?? existing?.subscription_id ?? null,
    trialEnd: isoFromSeconds(args.object['trial_end']),
    periodEnd:
      isoFromSeconds(args.object['current_period_end']) ??
      existing?.current_period_end ??
      null,
    graceUntil: grace,
    cancelAtPeriodEnd: args.object['cancel_at_period_end'] === true,
  });
  return 'applied';
}

export function subscriptionEntitled(
  row: {
    readonly status: string;
    readonly trial_end: string | null;
    readonly current_period_end: string | null;
    readonly grace_until: string | null;
  } | null,
  nowMs: number
): boolean {
  if (row === null) return false;
  const until = (value: string | null) =>
    value !== null && Date.parse(value) > nowMs;
  if (row.status === 'trialing') return until(row.trial_end);
  if (row.status === 'active') return until(row.current_period_end);
  if (row.status === 'past_due') return until(row.grace_until);
  if (row.status === 'canceled') return until(row.current_period_end);
  return false;
}
