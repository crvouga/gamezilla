import { recordPaymentEvidence } from '@libs/billing-shared-ts/payment-evidence';
import type { MembershipBilling } from '@pkgs/billing-root-shared-ts/membership';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';

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
