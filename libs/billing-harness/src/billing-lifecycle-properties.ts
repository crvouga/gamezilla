/**
 * Standing properties of the membership lifecycle, checked after every
 * lifecycle stimulus (`billing-lifecycle-stimuli.ts`):
 *
 * - the server's projection agrees with every subscription the provider holds
 *   for the payer (status, price, cancel flag);
 * - an account has at most one membership that is not over;
 * - every signed-in device that can reach the server holds exactly the
 *   server's rows (offline devices converge once back);
 * - the tier each device shows is what billing's membership reading makes
 *   of that device's own rows at the harness clock.
 */

import {
  governingRow,
  rowGrantsMembership,
} from '@libs/billing-shared/governing-row';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared/plus-membership-offer';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness/identity';
import { actorIds, partitioned } from '@libs/harness/observations';
import { membershipStatusOf } from '@pkgs/billing-stripe-shared/membership-status';
import { defineProperty } from '@pkgs/harness-shared/define-property';
import type { CheckpointAction } from '@pkgs/harness-shared/effect';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';
import { readLastSyncedAtMs } from '@pkgs/sync-engine-client/last-synced';
import {
  BILLING_PAYER,
  BILLING_SECOND_DEVICE,
  billingStimulus,
} from './billing-lifecycle-stimuli';
import { subscriptionsEverywhere } from './billing-provider-driver';
import { billingTier } from './billing-reads';

const DEFAULT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checked after each lifecycle stimulus; the setup before the first (sign-in,
 * spawning the second device) passes through states these do not describe.
 */
function walkStep(action: CheckpointAction): boolean {
  return billingStimulus.is(action);
}

type Row = {
  readonly provider_subscription_id: string;
  readonly status: string;
  readonly price_key: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

function flag(value: Row['cancel_at_period_end']): boolean {
  return value === true || value === 1;
}

/** Rows as comparable values, keyed and sorted by subscription id. */
function canonical(rows: readonly Row[]): readonly string[] {
  return rows
    .map((row) =>
      JSON.stringify([
        row.provider_subscription_id,
        row.status,
        row.price_key,
        row.current_period_end === null
          ? null
          : Date.parse(row.current_period_end),
        flag(row.cancel_at_period_end),
      ])
    )
    .sort();
}

async function rowsIn(db: SqlTx, accountId: string): Promise<readonly Row[]> {
  return await db.query(sql<Row>`
    SELECT provider_subscription_id, status, price_key, current_period_end,
      cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${accountId} AND deleted_at IS NULL`);
}

async function payerAccount(s: ProductHarness): Promise<string | null> {
  return await accountIdOf(s, BILLING_PAYER);
}

/** The second device signs in with the payer's address, so it is their account. */
async function deviceAccount(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return await accountIdOf(
    s,
    actorId === BILLING_SECOND_DEVICE ? BILLING_PAYER : actorId
  );
}

function offerKeyOf(lookupKey: string | null | undefined): string | null {
  const match = Object.values(PLUS_MEMBERSHIP_OFFER.prices).find(
    (spec) => spec.catalogPriceId === lookupKey
  );
  return match?.key ?? null;
}

export const billingServerAgreesWithProvider = defineProperty({
  name: 'billingServerAgreesWithProvider',
  check: async (
    s: ProductHarness,
    _model: unknown,
    action: CheckpointAction
  ) => {
    if (!walkStep(action)) return;
    const accountId = await payerAccount(s);
    if (accountId === null || s.harness.billing === null) return;
    const server = await rowsIn(s.harness.serverSql.sqlClient, accountId);
    // Never checked out anywhere: nothing at a provider to agree with.
    const everywhere = await subscriptionsEverywhere(s, accountId);
    for (const sub of everywhere.flatMap((at) => at.subscriptions)) {
      const row = server.find((r) => r.provider_subscription_id === sub.id);
      const expected = {
        status: membershipStatusOf(sub.status),
        price_key: offerKeyOf(sub.items.data[0]?.price.lookup_key),
        cancel:
          membershipStatusOf(sub.status) !== 'ended' &&
          sub.cancel_at_period_end,
      };
      const actual =
        row === undefined
          ? null
          : {
              status: row.status,
              price_key: row.price_key,
              cancel: flag(row.cancel_at_period_end),
            };
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `projection of ${sub.id} (${sub.status}) is ${JSON.stringify(actual)}, provider says ${JSON.stringify(expected)}`
        );
      }
    }
  },
});

export const billingOneLiveMembership = defineProperty({
  name: 'billingOneLiveMembership',
  check: async (
    s: ProductHarness,
    _model: unknown,
    action: CheckpointAction
  ) => {
    if (!walkStep(action)) return;
    const accountId = await payerAccount(s);
    if (accountId === null) return;
    const live = (
      await rowsIn(s.harness.serverSql.sqlClient, accountId)
    ).filter((row) => row.status !== 'ended');
    if (live.length > 1) {
      throw new Error(
        `${String(live.length)} live memberships: ${canonical(live).join(', ')}`
      );
    }
  },
});

function offline(s: ProductHarness, actorId: string): boolean {
  return partitioned(s).some((pair) => pair.split('|').includes(actorId));
}

export const billingDevicesConverge = defineProperty({
  name: 'billingDevicesConverge',
  check: async (
    s: ProductHarness,
    _model: unknown,
    action: CheckpointAction
  ) => {
    if (!walkStep(action)) return;
    for (const actorId of actorIds(s)) {
      const accountId = await deviceAccount(s, actorId);
      const local = actorLocalSql(s, actorId);
      if (accountId === null || local === null || offline(s, actorId)) continue;
      const server = canonical(
        await rowsIn(s.harness.serverSql.sqlClient, accountId)
      );
      const mine = canonical(await rowsIn(local, accountId));
      if (JSON.stringify(mine) !== JSON.stringify(server)) {
        throw new Error(
          `${actorId} holds ${JSON.stringify(mine)}, server holds ${JSON.stringify(server)}`
        );
      }
    }
  },
});

async function graceMs(db: SqlTx): Promise<number> {
  const rows = await db.query(sql<{ readonly value: unknown }>`
    SELECT value FROM client_config
    WHERE id = 'billing_grace_period_ms' AND deleted_at IS NULL`);
  const raw = rows[0]?.value;
  const parsed =
    typeof raw === 'string' ? Number(JSON.parse(raw)) : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_GRACE_MS;
}

export const billingTierMatchesMembership = defineProperty({
  name: 'billingTierMatchesMembership',
  check: async (
    s: ProductHarness,
    _model: unknown,
    action: CheckpointAction
  ) => {
    if (!walkStep(action)) return;
    for (const actorId of actorIds(s)) {
      const shown = await billingTier(s, actorId);
      const local = actorLocalSql(s, actorId);
      if (shown === null || local === null) continue;
      const accountId = await deviceAccount(s, actorId);
      const rows = accountId === null ? [] : await rowsIn(local, accountId);
      const governing = governingRow(rows);
      const member = rowGrantsMembership(governing, {
        nowMs: s.session.ports.clock.now(),
        graceMs: await graceMs(local),
        confirmedAtMs: await readLastSyncedAtMs(local),
      });
      const expected = member ? 'paid' : 'free';
      if (shown !== expected) {
        throw new Error(
          `${actorId} shows "${shown}", membership says ${expected} for ${JSON.stringify(governing)} at ${new Date(s.session.ports.clock.now()).toISOString()}`
        );
      }
    }
  },
});

export const BILLING_LIFECYCLE_PROPERTIES = [
  billingServerAgreesWithProvider,
  billingOneLiveMembership,
  billingDevicesConverge,
  billingTierMatchesMembership,
];
