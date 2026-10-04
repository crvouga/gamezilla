import type { MembershipStatus } from '@pkgs/billing-shared/membership';
import type {
  AccessMoment,
  MembershipStanding,
} from '@pkgs/billing-shared/precedence';
import {
  governingMembership,
  isMembershipLive,
  membershipAccessLapsesAtMs,
  membershipGrantsAccess,
  readMembershipStatus,
} from '@pkgs/billing-shared/precedence';

import type { Facts } from '@pkgs/permissions-shared/facts';

/**
 * The only place raw sign-in state and membership become access input. Both
 * enter as `Facts` the policy's predicates read; nothing downstream of this
 * module sees a sign-in flag, a membership status or a plan.
 */

/** Last-known membership state: our vocabulary, never a vendor status. */
export type SubscriptionSnapshot = {
  readonly status: MembershipStatus;
  readonly currentPeriodEndMs: number | null;
  readonly cancelAtPeriodEnd: boolean;
};

/** Synced `billing_subscriptions` row shape (snake_case, sqlite/postgres booleans). */
export type SubscriptionRow = {
  readonly status: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

/**
 * Maps a synced subscription row to a snapshot. `undefined`, a blank status or
 * a status outside our vocabulary means "no membership" — an unreadable row
 * grants nothing. An unparsable period end becomes `null`.
 */
export function readSubscriptionSnapshot(
  row: SubscriptionRow | undefined
): SubscriptionSnapshot | null {
  if (row === undefined) return null;
  const status = readMembershipStatus(row.status);
  if (status === null) return null;
  const parsed =
    row.current_period_end === null
      ? Number.NaN
      : Date.parse(row.current_period_end);
  return {
    status,
    currentPeriodEndMs: Number.isFinite(parsed) ? parsed : null,
    cancelAtPeriodEnd:
      row.cancel_at_period_end === true || row.cancel_at_period_end === 1,
  };
}

/**
 * The snapshot that decides access among all of an account's rows — one per
 * provider it ever joined through, more after a resubscribe. The one granting
 * the most governs, not the newest (`governingMembership`). Rows arrive newest
 * first, which breaks full ties.
 */
export function governingSubscription(
  rows: readonly SubscriptionRow[]
): SubscriptionSnapshot | null {
  const snapshots = rows.flatMap((row) => {
    const snapshot = readSubscriptionSnapshot(row);
    return snapshot === null ? [] : [snapshot];
  });
  return governingMembership(snapshots, (snapshot) => ({
    status: snapshot.status,
    periodEndMs: snapshot.currentPeriodEndMs,
  }));
}

/** Raw inputs the facts are resolved from. */
export type AccessInputs = {
  readonly signedIn: boolean;
  readonly accountId: string | null;
  readonly subscription: SubscriptionSnapshot | null;
  readonly nowMs: number;
  readonly graceMs: number;
  /**
   * When the membership was last confirmed with the server: `nowMs` on the
   * server, the last sync on a device (`null`: no confirmation on record).
   */
  readonly confirmedAtMs: number | null;
  /** The deployment has a membership provider (`billing_enabled`). */
  readonly billingEnabled: boolean;
};

function standingOf(subscription: SubscriptionSnapshot): MembershipStanding {
  return {
    status: subscription.status,
    periodEndMs: subscription.currentPeriodEndMs,
  };
}

function momentOf(inputs: AccessInputs): AccessMoment {
  return {
    nowMs: inputs.nowMs,
    graceMs: inputs.graceMs,
    confirmedAtMs: inputs.confirmedAtMs,
  };
}

/**
 * Raw inputs → the `Facts` the policy's predicates read. `auth` is
 * `anonymous` | `verified`; `membership` is `active` while the governing
 * membership grants access (`membershipGrantsAccess`: grace keeps a member a
 * member through a lapse and while offline, up to `graceMs` without
 * confirming it); `subscription` is `live` while the governing membership
 * still renews (`isMembershipLive`: a second one would bill twice), `none`
 * once it ended, even inside grace; `billing` is `on` | `off`.
 */
export function resolveAccessFacts(inputs: AccessInputs): Facts {
  const subscription = inputs.signedIn ? inputs.subscription : null;
  const member =
    subscription !== null &&
    membershipGrantsAccess(standingOf(subscription), momentOf(inputs));
  const live = subscription !== null && isMembershipLive(subscription.status);
  return {
    auth: inputs.signedIn ? 'verified' : 'anonymous',
    accountId: inputs.signedIn ? inputs.accountId : null,
    membership: member ? 'active' : 'none',
    subscription: live ? 'live' : 'none',
    billing: inputs.billingEnabled ? 'on' : 'off',
  };
}

/** When the facts would change with only time passing, or `null`. */
export function accessFactsChangeAtMs(inputs: AccessInputs): number | null {
  const subscription = inputs.subscription;
  if (!inputs.signedIn || subscription === null) return null;
  return membershipAccessLapsesAtMs(standingOf(subscription), momentOf(inputs));
}
