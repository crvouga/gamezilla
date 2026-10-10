import {
  createDomainEvent,
  telemetrySubjectId,
} from '@libs/observability-shared/domain-event';
import type { MembershipPayment } from '@pkgs/billing-root-shared/membership';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';

export const paymentReconciledEvent = createDomainEvent(
  defineEvent({
    name: 'membership.payment.reconciled',
    version: 1,
    owner: 'billing',
    description:
      'Authoritative payment evidence was reconciled with its provider.',
    delivery: 'authoritative',
    attributes: {
      'payment.id': { type: 'string', required: true },
      'payment.currency': { type: 'string', required: true },
      'payment.amount_minor': { type: 'number', required: true, minimum: 0 },
      'payment.refunded_minor': { type: 'number', required: true, minimum: 0 },
    },
  })
);
export const subscriptionProjectedEvent = createDomainEvent(
  defineEvent({
    name: 'membership.subscription.projected',
    version: 1,
    owner: 'billing',
    description: 'The authoritative current subscription state was projected.',
    delivery: 'authoritative',
    attributes: {
      'subscription.id': { type: 'string', required: true },
      'subscription.status': { type: 'string', required: true },
      'subscription.cancel_at_period_end': { type: 'boolean', required: true },
    },
  })
);
export const BILLING_TELEMETRY = [
  paymentReconciledEvent,
  subscriptionProjectedEvent,
] as const;

/** Snapshots never replace the payment ledger and must never be summed as revenue. */
export async function recordPaymentTelemetry(
  tx: SqlTx,
  provider: string,
  payment: MembershipPayment,
  nowMs: number
): Promise<void> {
  const id = telemetrySubjectId(`${provider}:${payment.id}`);
  const revision = telemetrySubjectId(
    JSON.stringify([
      id,
      payment.amountMinor,
      payment.currency,
      payment.refundedMinor,
    ])
  );
  await paymentReconciledEvent.outbox.enqueue(
    {
      tx,
      env: {
        now: () => new Date(nowMs),
        createId: () => revision,
      },
    },
    {
      envelope: { id: revision, occurredAtMs: nowMs },
      attributes: {
        'payment.id': id,
        'payment.currency': payment.currency,
        'payment.amount_minor': payment.amountMinor,
        'payment.refunded_minor': payment.refundedMinor,
      },
    }
  );
}
