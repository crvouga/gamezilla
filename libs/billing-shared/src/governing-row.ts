/**
 * An account may hold membership rows at several providers (and several at
 * one, after a resubscribe). The row that decides what the account has is the
 * one granting the most — never simply the newest, or a late callback about
 * a membership that ended at one provider would hide a live one at another.
 */
import type {
  AccessMoment,
  MembershipStanding,
} from '@pkgs/billing-root-shared/precedence';
import {
  governingMembership,
  membershipAccessLapsesAtMs,
  membershipGrantsAccess,
  readMembershipStatus,
} from '@pkgs/billing-root-shared/precedence';

/** The stored columns precedence reads (text status, ISO period end). */
export type StandingColumns = {
  readonly status: string | null;
  readonly current_period_end: string | null;
};

function periodEndMs(value: string | null): number | null {
  if (value === null) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function standingOf(row: StandingColumns): MembershipStanding {
  return {
    status: readMembershipStatus(row.status),
    periodEndMs: periodEndMs(row.current_period_end),
  };
}

/** The governing row of `rows` (newest first breaks full ties), or `null`. */
export function governingRow<T extends StandingColumns>(
  rows: readonly T[]
): T | null {
  return governingMembership(rows, standingOf);
}

/**
 * Whether `row` makes its account a member at `at.nowMs` (grace included, and
 * only while it was confirmed with the server within grace).
 */
export function rowGrantsMembership(
  row: StandingColumns | null,
  at: AccessMoment
): boolean {
  return row !== null && membershipGrantsAccess(standingOf(row), at);
}

/** When `row` stops granting with only time passing, or `null`. */
export function rowMembershipLapsesAtMs(
  row: StandingColumns | null,
  at: AccessMoment
): number | null {
  return row === null ? null : membershipAccessLapsesAtMs(standingOf(row), at);
}
