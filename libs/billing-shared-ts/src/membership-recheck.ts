/**
 * A membership that is not over is asked about again after its period end,
 * so a provider's news that never arrived (a webhook it stopped retrying)
 * cannot leave it stale forever. Each projection of a live membership
 * schedules one re-check through the outbox; the scheduled sweep that drains
 * the outbox runs it, a bounded batch at a time.
 */
import type { MembershipChange } from '@pkgs/billing-root-shared-ts/membership';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';

const HOUR_MS = 60 * 60 * 1000;

/**
 * How long after a period end the re-check waits: past the provider's own
 * renewal and its first webhook retries, so it only does work when the news
 * really went missing.
 */
export const MEMBERSHIP_RECHECK_AFTER_PERIOD_END_MS = 24 * HOUR_MS;

/** The soonest a membership is asked about again, however stale it is. */
export const MEMBERSHIP_RECHECK_MIN_INTERVAL_MS = 24 * HOUR_MS;

export const membershipRecheckDue = createMessageNamespace(
  'billing',
  'membership'
)(
  'recheck-due',
  (
    value
  ): value is {
    readonly provider: string;
    readonly subscriptionId: string;
  } =>
    isPlainRecord(value) &&
    typeof value['provider'] === 'string' &&
    typeof value['subscriptionId'] === 'string'
);

/** When the membership `change` reports should be asked about again, or never. */
export function membershipRecheckAtMs(
  change: MembershipChange,
  nowMs: number
): number | null {
  if (change.membership.status === 'ended') return null;
  const afterPeriod =
    (change.membership.periodEndMs ?? nowMs) +
    MEMBERSHIP_RECHECK_AFTER_PERIOD_END_MS;
  return Math.max(afterPeriod, nowMs + MEMBERSHIP_RECHECK_MIN_INTERVAL_MS);
}

/**
 * Schedules the re-check of a projected membership. One per subscription and
 * re-check time: projecting the same news twice schedules nothing new.
 */
export async function scheduleMembershipRecheck(
  tx: SqlTx,
  change: MembershipChange,
  nowMs: number
): Promise<void> {
  const atMs = membershipRecheckAtMs(change, nowMs);
  if (atMs === null) return;
  const id = `billing-recheck:${change.provider}:${change.subscriptionId}:${String(atMs)}`;
  await new Outbox({
    tx,
    env: { now: () => new Date(nowMs), createId: () => id },
  }).send({
    id,
    message: membershipRecheckDue({
      provider: change.provider,
      subscriptionId: change.subscriptionId,
    }),
    availableAt: new Date(atMs),
  });
}
