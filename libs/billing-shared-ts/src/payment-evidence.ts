import type { MembershipPayment } from '@pkgs/billing-root-shared-ts/membership';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { recordPaymentTelemetry } from './telemetry';

export const paymentRetentionEnded = createMessageNamespace(
  'billing',
  'privacy'
)(
  'retention-ended',
  (value): value is { readonly paymentId: string } =>
    isPlainRecord(value) && typeof value['paymentId'] === 'string'
);

export function paymentEraseBy(paidAtMs: number): string {
  const end = new Date(paidAtMs);
  end.setUTCFullYear(end.getUTCFullYear() + 7);
  return end.toISOString();
}

export async function recordPaymentEvidence(
  tx: SqlTx,
  accountId: string,
  provider: string,
  input: { payments: readonly MembershipPayment[]; nowMs: number }
): Promise<void> {
  const { payments, nowMs } = input;
  const now = new Date(nowMs).toISOString();
  for (const payment of payments) {
    const eraseBy = paymentEraseBy(payment.paidAtMs);
    // regression: expired-payment-evidence-replay
    // A provider reread includes old charges after their evidence was erased.
    if (Date.parse(eraseBy) <= nowMs) {
      const retained = await tx.query(sql<{ id: string }>`
        UPDATE billing_payment_evidence SET refunded_minor = ${payment.refundedMinor}, updated_at = ${now}
        WHERE id = ${`${provider}:${payment.id}`} AND deleted_at IS NULL AND legal_purpose IS NOT NULL
        RETURNING *
      `);
      if (retained.length > 0)
        await recordPaymentTelemetry(tx, provider, payment, nowMs);
      continue;
    }
    const recorded = await tx.query(sql<{ id: string }>`
      INSERT INTO billing_payment_evidence (id, created_at, updated_at, account_id, provider, payment_id, paid_at, amount_minor, currency, refunded_minor, erase_by)
      VALUES (${`${provider}:${payment.id}`}, ${now}, ${now}, ${accountId}, ${provider}, ${payment.id}, ${new Date(payment.paidAtMs).toISOString()}, ${payment.amountMinor}, ${payment.currency}, ${payment.refundedMinor}, ${eraseBy})
      ON CONFLICT (id) DO UPDATE SET refunded_minor = ${payment.refundedMinor}, updated_at = ${now}
      WHERE billing_payment_evidence.deleted_at IS NULL
      RETURNING *
    `);
    if (recorded.length === 0) continue;
    const eventId = `billing-payment-retention:${provider}:${payment.id}`;
    await new Outbox({
      tx,
      env: { now: () => new Date(nowMs), createId: () => eventId },
    }).send({
      id: eventId,
      message: paymentRetentionEnded({ paymentId: payment.id }),
    });
    await tx.run(
      sql`UPDATE outbox_events SET available_at = ${eraseBy} WHERE id = ${eventId}`
    );
    await recordPaymentTelemetry(tx, provider, payment, nowMs);
  }
}

export async function eraseExpiredPaymentEvidence(
  tx: SqlTx,
  nowMs: number
): Promise<void> {
  const now = new Date(nowMs).toISOString();
  await tx.run(
    sql`UPDATE billing_payment_evidence SET deleted_at = ${now}, account_id = ${null}, payment_id = ${null}, paid_at = ${null}, amount_minor = ${null}, currency = ${null}, refunded_minor = ${null}, updated_at = ${now} WHERE erase_by <= ${now} AND legal_purpose IS NULL AND deleted_at IS NULL`
  );
}
