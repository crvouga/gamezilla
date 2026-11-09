import type { CancellationFeedbackRow } from '@libs/billing-shared-ts/cancellation-feedback';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

export type FeedbackReportWindow = {
  readonly from: string;
  readonly until: string;
  readonly afterId?: string | undefined;
};

/** Bounded operator report, ordered by stable row identity for pagination. */
export async function cancellationFeedbackReport(
  tx: SqlTx,
  window: FeedbackReportWindow
): Promise<readonly CancellationFeedbackRow[]> {
  const from = Date.parse(window.from);
  const until = Date.parse(window.until);
  if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until)
    throw new Error(
      'Supply a valid UTC reporting window with from before until'
    );
  return tx.query(sql<CancellationFeedbackRow>`
    SELECT id, account_id, subscription_id, reason, comment, updated_at
    FROM billing_cancellation_feedback
    WHERE deleted_at IS NULL AND updated_at >= ${new Date(from).toISOString()}
      AND updated_at < ${new Date(until).toISOString()}
      AND id > ${window.afterId ?? ''}
    ORDER BY id ASC LIMIT 100
  `);
}

/** The CLI and harness use the same authenticated-operator reporting path. */
export async function cancellationFeedbackReportCommand(
  tx: SqlTx,
  argv: readonly string[]
) {
  const [from, until, afterId] = argv;
  if (from === undefined || until === undefined || argv.length > 3)
    throw new Error(
      'Usage: billing:feedback <from-UTC> <until-UTC> [after-id]'
    );
  const feedback = await cancellationFeedbackReport(tx, {
    from,
    until,
    afterId,
  });
  return {
    from,
    until,
    feedback,
    nextAfterId: feedback.length === 100 ? (feedback[99]?.id ?? null) : null,
  };
}
