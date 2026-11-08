import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type {
  CancellationFeedback,
  CancellationReason,
} from '@libs/billing-shared-ts/cancellation-feedback';
import { governingRow } from '@libs/billing-shared-ts/governing-row';
import { shareCancellationFeedbackMutation } from '@libs/billing-shared-ts/share-cancellation-feedback-mutation';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { createMemo, type JSX, Show } from 'solid-js';
import { CancellationFeedbackForm } from './cancellation-feedback-form';
import { useFeedbackDelivery } from './use-feedback-delivery';

type FeedbackQueryRow = {
  id: string;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | number | null;
  canceled_at: string | null;
  reason: CancellationReason | null;
  comment: string | null;
};

/**
 * Feedback is about the membership that decides what the person has now: a
 * newer live membership (a resubscribe, another provider) is not canceled,
 * so an older cancellation is no longer asked about.
 */
function canceledGoverning(
  rows: readonly FeedbackQueryRow[]
): FeedbackQueryRow | null {
  const governing = governingRow(rows);
  if (governing === null) return null;
  if (governing.cancel_at_period_end) return governing;
  return governing.status === 'ended' && governing.canceled_at !== null
    ? governing
    : null;
}

/** Reads only the acting person's canceled membership and optional answer. */
export function CancellationFeedbackSection(): JSX.Element {
  const myId = useMyId();
  const canManage = useCan(PERMISSION.billingManage);
  const engine = useSyncEngine();
  const mutations = useMutationClient();
  const query = createQuery(
    () => sql<FeedbackQueryRow>`
    SELECT membership.id, membership.status, membership.current_period_end,
      membership.cancel_at_period_end, membership.canceled_at,
      feedback.reason, feedback.comment
    FROM billing_subscriptions AS membership
    LEFT JOIN billing_cancellation_feedback AS feedback
      ON feedback.subscription_id = membership.id AND feedback.deleted_at IS NULL
    WHERE membership.account_id = ${myId()} AND membership.deleted_at IS NULL
    ORDER BY membership.updated_at DESC LIMIT 50
  `
  );
  const row = createMemo(() => canceledGoverning(query.rows()));
  const delivery = useFeedbackDelivery(() => row()?.id ?? '');
  const saved = (): CancellationFeedback | null => {
    const rejected = delivery.rejectedAnswer();
    if (rejected !== null) return rejected;
    const current = row();
    return current?.reason === null || current?.reason === undefined
      ? null
      : { reason: current.reason, comment: current.comment ?? '' };
  };
  const save = async (
    id: string,
    answer: CancellationFeedback
  ): Promise<void> => {
    const result = await mutations.mutate(shareCancellationFeedbackMutation, {
      subscriptionId: id,
      ...answer,
    });
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ?? 'Feedback could not be saved'
      );
  };
  return (
    <Show when={canManage() && row()?.id} keyed>
      {(id) => (
        <CancellationFeedbackForm
          saved={saved()}
          online={engine.status().online}
          delivery={delivery.status()}
          onSave={(answer) => save(id, answer)}
        />
      )}
    </Show>
  );
}
