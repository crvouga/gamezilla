import type { CancellationFeedbackRow } from '@libs/billing-shared-ts/cancellation-feedback';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

/** Internal team reporting only. Comments never enter metrics or public APIs. */
export async function cancellationFeedbackReport(
  tx: SqlTx
): Promise<readonly CancellationFeedbackRow[]> {
  return tx.query(sql<CancellationFeedbackRow>`
    SELECT id, account_id, subscription_id, reason, comment, updated_at
    FROM billing_cancellation_feedback WHERE deleted_at IS NULL
    ORDER BY updated_at DESC, id ASC
  `);
}
