import type { MembershipBilling } from '@pkgs/billing';
import type { SqlTx } from '@pkgs/sql-client/interface';
import { recordPaymentEvidence } from '../../../shared/memberships/payment-evidence';

export async function settleDeletedAccountPayments(args: {
  tx: SqlTx;
  provider: MembershipBilling;
  customerId: string;
  accountId: string;
  confirmedAtMs: number;
  nowMs: number;
}): Promise<void> {
  const { tx, provider, customerId, accountId, confirmedAtMs, nowMs } = args;
  const payments = await provider.readPayments(customerId);
  for (const payment of payments) {
    if (
      payment.paidAtMs >= confirmedAtMs &&
      payment.refundedMinor < payment.amountMinor
    )
      await provider.refundPayment(payment.id);
  }
  const settled = await provider.readPayments(customerId);
  if (
    settled.some(
      (payment) =>
        payment.paidAtMs >= confirmedAtMs &&
        payment.refundedMinor < payment.amountMinor
    )
  )
    throw new Error('Payment return is still pending.');
  await recordPaymentEvidence(tx, accountId, provider.provider, {
    payments: settled,
    nowMs,
  });
}
