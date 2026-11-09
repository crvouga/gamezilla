import { scheduleMembershipRecheck } from '@libs/billing-shared-ts/membership-recheck';
import type { MembershipChange } from '@pkgs/billing-root-shared-ts/membership';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type {
  SqlClient,
  SqlTx,
} from '@pkgs/sql-client-root-shared-ts/interface';

import { BillingSubscriptionRepository } from './billing-subscription-repository';

/**
 * Projects the membership change a provider reported — a verified callback,
 * a checkout that found the membership already paid, or a re-check — and
 * schedules the next re-check while the membership is not over.
 */
export async function projectMembershipChange(args: {
  readonly tx: SqlTx;
  readonly clock: Clock;
  readonly accountId: string;
  readonly change: MembershipChange;
}): Promise<boolean> {
  const { change } = args;
  const applied = await new BillingSubscriptionRepository(
    args.tx,
    args.clock
  ).upsert({
    provider: change.provider,
    accountId: args.accountId,
    subscriptionId: change.subscriptionId,
    offerPriceKey: change.offerPriceKey,
    status: change.membership.status,
    periodEndMs: change.membership.periodEndMs,
    endsAtPeriodEnd: change.membership.endsAtPeriodEnd,
    creditCents: change.creditCents ?? null,
  });
  if (applied) {
    await scheduleMembershipRecheck(args.tx, change, args.clock.now());
  }
  return applied;
}

/**
 * The single writer of `billing_subscriptions`: opens one transaction and
 * projects the change.
 */
export async function applyMembershipChange(args: {
  readonly sql: SqlClient;
  readonly clock: Clock;
  readonly accountId: string;
  readonly change: MembershipChange;
}): Promise<boolean> {
  return args.sql.transaction((tx) => projectMembershipChange({ ...args, tx }));
}

/** Whether two readings of one membership project the same row. */
function sameReading(a: MembershipChange, b: MembershipChange): boolean {
  return (
    a.subscriptionId === b.subscriptionId &&
    a.offerPriceKey === b.offerPriceKey &&
    a.membership.status === b.membership.status &&
    a.membership.periodEndMs === b.membership.periodEndMs &&
    a.membership.endsAtPeriodEnd === b.membership.endsAtPeriodEnd &&
    (a.creditCents ?? null) === (b.creditCents ?? null)
  );
}

/** Writes a reading may take before the next re-check settles it. */
const MAX_PROJECTIONS = 3;

/**
 * Projects a provider reading, then asks the provider again and projects
 * again until the answer matches what was written. Readings about one
 * membership can commit out of order (two callbacks, a callback and a
 * checkout); because every writer reads after its own last write, the last
 * write always agrees with a reading taken after it, so an older reading can
 * never be what remains. No lock is held while the provider is asked.
 * `read` returns `null` when the provider no longer knows the membership.
 */
export async function applyCurrentMembership(args: {
  readonly sql: SqlClient;
  readonly clock: Clock;
  readonly accountId: string;
  readonly change: MembershipChange;
  readonly read: () => Promise<MembershipChange | null>;
}): Promise<boolean> {
  let change = args.change;
  let applied = false;
  for (let attempt = 0; attempt < MAX_PROJECTIONS; attempt++) {
    const written = change;
    applied =
      (await applyMembershipChange({ ...args, change: written })) || applied;
    const current = await args.read();
    if (
      current === null ||
      current.provider !== written.provider ||
      current.customerId !== written.customerId ||
      sameReading(current, written)
    )
      return applied;
    change = current;
  }
  return applied;
}
