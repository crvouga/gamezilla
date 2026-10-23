import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

export type SettledPaymentTotal = {
  readonly currency: string;
  readonly payments: string;
  readonly settledMinor: string;
  readonly refundedMinor: string;
  readonly netMinor: string;
};

/** Version 1: authoritative settled cash, grouped by currency and original
 * payment time in [from, until) UTC. Refunds reflect the current reconciled
 * evidence. These are cash totals, not recognized revenue or recurring value. */
export async function settledPaymentReport(
  tx: SqlTx,
  window: {
    readonly fromMs: number;
    readonly untilMs: number;
  }
): Promise<readonly SettledPaymentTotal[]> {
  if (
    !Number.isSafeInteger(window.fromMs) ||
    !Number.isSafeInteger(window.untilMs) ||
    window.fromMs < 0 ||
    window.untilMs <= window.fromMs
  )
    throw new Error('Invalid reporting window');
  const rows = await tx.query(sql<{
    currency: string;
    payments: string | number;
    settled: string | number;
    refunded: string | number;
  }>`
    SELECT currency, COUNT(*) AS payments,
      SUM(amount_minor) AS settled, SUM(refunded_minor) AS refunded
    FROM billing_payment_evidence
    WHERE deleted_at IS NULL
      AND paid_at >= ${new Date(window.fromMs).toISOString()}
      AND paid_at < ${new Date(window.untilMs).toISOString()}
    GROUP BY currency
    ORDER BY currency
  `);
  return rows.map((row) => {
    const settled = minorUnits(row.settled);
    const refunded = minorUnits(row.refunded);
    if (refunded > settled)
      throw new Error('Refund exceeds settled payment evidence');
    return {
      currency: row.currency,
      payments: minorUnits(row.payments).toString(),
      settledMinor: settled.toString(),
      refundedMinor: refunded.toString(),
      netMinor: (settled - refunded).toString(),
    };
  });
}

function minorUnits(value: string | number): bigint {
  if (
    (typeof value === 'number' &&
      (!Number.isSafeInteger(value) || value < 0)) ||
    (typeof value === 'string' && !/^\d+$/.test(value))
  )
    throw new Error('Unsafe financial aggregate');
  return BigInt(value);
}
