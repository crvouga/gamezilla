/**
 * Which of an account's memberships decides its access.
 *
 * An account can hold more than one membership row: one per provider it ever
 * subscribed at, and a new one each time it subscribes again. The newest row
 * is not the answer — a late callback about a membership that ended at the
 * old provider would then hide the live one at the new provider. The row that
 * governs is the one granting the most, whichever provider it came from.
 */
import type { MembershipStatus } from './membership';

/** A membership as far as precedence needs it; `null` status is unreadable. */
export type MembershipStanding = {
  readonly status: MembershipStatus | null;
  readonly periodEndMs: number | null;
};

/** Paid outranks a trial, so two live rows never tie on status. */
const RANK: Readonly<Record<MembershipStatus, number>> = {
  active: 4,
  trialing: 3,
  delinquent: 2,
  incomplete: 1,
  ended: 0,
};

function rank(standing: MembershipStanding): number {
  return standing.status === null ? -1 : RANK[standing.status];
}

/** True when `a` should govern over `b`. Ties keep `b` (the earlier one). */
export function outranksMembership(
  a: MembershipStanding,
  b: MembershipStanding
): boolean {
  const byRank = rank(a) - rank(b);
  if (byRank !== 0) return byRank > 0;
  return (
    (a.periodEndMs ?? Number.NEGATIVE_INFINITY) >
    (b.periodEndMs ?? Number.NEGATIVE_INFINITY)
  );
}

/**
 * The governing item: active over trialing over delinquent over incomplete
 * over ended over unreadable, then the later period end. Only rows equal in
 * both tie, and those keep input order (callers list newest first).
 */
export function governingMembership<T>(
  items: readonly T[],
  standingOf: (item: T) => MembershipStanding
): T | null {
  let best: T | null = null;
  let bestStanding: MembershipStanding | null = null;
  for (const item of items) {
    const standing = standingOf(item);
    if (bestStanding === null || outranksMembership(standing, bestStanding)) {
      best = item;
      bestStanding = standing;
    }
  }
  return best;
}

/** A membership that still grants, or will once paid: no second checkout. */
export function isMembershipLive(status: MembershipStatus | null): boolean {
  return (
    status === 'active' || status === 'trialing' || status === 'delinquent'
  );
}

/** When access is judged, and how much it tolerates. */
export type AccessMoment = {
  readonly nowMs: number;
  /** How long access outlasts a period end, and an unconfirmed membership. */
  readonly graceMs: number;
  /**
   * When the membership was last confirmed with the server (epoch ms): the
   * server itself judges at `nowMs`; a device passes the last time the server
   * answered it. `null` means no confirmation is on record (rows that never
   * came from a server), which sets no limit.
   */
  readonly confirmedAtMs: number | null;
};

/** The instant access runs out by itself, or `null` when time alone never ends it. */
function accessRunsOutAtMs(
  standing: MembershipStanding,
  at: AccessMoment
): number | null {
  const unconfirmedAfter =
    at.confirmedAtMs === null ? null : at.confirmedAtMs + at.graceMs;
  const live = standing.status === 'active' || standing.status === 'trialing';
  const periodAfter =
    live || standing.periodEndMs === null
      ? null
      : standing.periodEndMs + at.graceMs;
  if (unconfirmedAfter === null) return periodAfter;
  if (periodAfter === null) return unconfirmedAfter;
  return Math.min(unconfirmedAfter, periodAfter);
}

/**
 * Whether a membership grants member access at `nowMs`: while it is active or
 * trialing, and — for a delinquent or ended one — until its period end plus
 * `graceMs`. An ended one with no period end (refunded: no paid time left),
 * an incomplete or an unreadable one grants nothing. Whatever it says, it
 * stops granting `graceMs` after it was last confirmed: a device offline for
 * longer falls back to free, and gets its answer back on the next sync.
 */
export function membershipGrantsAccess(
  standing: MembershipStanding,
  at: AccessMoment
): boolean {
  if (standing.status === null || standing.status === 'incomplete') {
    return false;
  }
  const live = standing.status === 'active' || standing.status === 'trialing';
  if (!live && standing.periodEndMs === null) return false;
  const runsOut = accessRunsOutAtMs(standing, at);
  return runsOut === null || at.nowMs <= runsOut;
}

/**
 * The first instant after `at.nowMs` at which {@link membershipGrantsAccess}
 * turns false with nothing else changing, or `null` when it grants nothing
 * now or time alone never ends it — when a screen showing it must look again.
 */
export function membershipAccessLapsesAtMs(
  standing: MembershipStanding,
  at: AccessMoment
): number | null {
  if (!membershipGrantsAccess(standing, at)) return null;
  const runsOut = accessRunsOutAtMs(standing, at);
  return runsOut === null ? null : runsOut + 1;
}

const STATUSES: ReadonlySet<string> = new Set<MembershipStatus>(
  Object.keys(RANK) as MembershipStatus[]
);

/**
 * A stored status back into our vocabulary. Anything else — blank, or a word
 * a newer writer knows — is unreadable (`null`) and grants nothing.
 */
export function readMembershipStatus(
  value: string | null | undefined
): MembershipStatus | null {
  return typeof value === 'string' && STATUSES.has(value)
    ? (value as MembershipStatus)
    : null;
}
