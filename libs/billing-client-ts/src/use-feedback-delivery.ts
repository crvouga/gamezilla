import {
  cancellationFeedbackArgsSchema,
  shareCancellationFeedbackMutation,
} from '@libs/billing-shared-ts/share-cancellation-feedback-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import { type Accessor, createMemo } from 'solid-js';

/** A refused answer remains recoverable from the durable local choice. */
export function useFeedbackDelivery(subscriptionId: Accessor<string>) {
  const feedback = useMutationFeedback(
    shareCancellationFeedbackMutation.name,
    () => ({ subscriptionId: subscriptionId() })
  );
  const choice = createQuery(
    () => sql<{ args: string }>`
    SELECT args FROM sync_engine_mutations WHERE id = ${feedback()?.mutationId ?? ''}
  `
  );
  const rejectedAnswer = createMemo(() => {
    if (feedback()?.status !== 'rejected') return null;
    try {
      const value = cancellationFeedbackArgsSchema.safeParse(
        JSON.parse(choice.rows()[0]?.args ?? 'null')
      );
      return value.success
        ? { reason: value.data.reason, comment: value.data.comment }
        : null;
    } catch {
      return null;
    }
  });
  return { status: () => feedback()?.status ?? null, rejectedAnswer };
}
