import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type {
  CancellationFeedback,
  CancellationReason,
} from '@libs/billing-shared-ts/cancellation-feedback';
import { shareCancellationFeedbackMutation } from '@libs/billing-shared-ts/share-cancellation-feedback-mutation';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type JSX, Show } from 'solid-js';
import { CancellationFeedbackForm } from './cancellation-feedback-form';

type FeedbackQueryRow = {
  id: string;
  reason: CancellationReason | null;
  comment: string | null;
};

/** Reads only the acting person's canceled membership and optional answer. */
export function CancellationFeedbackSection(): JSX.Element {
  const myId = useMyId();
  const canManage = useCan(PERMISSION.billingManage);
  const engine = useSyncEngine();
  const mutations = useMutationClient();
  const query = createQuery(
    () => sql<FeedbackQueryRow>`
    SELECT membership.id, feedback.reason, feedback.comment
    FROM billing_subscriptions AS membership
    LEFT JOIN billing_cancellation_feedback AS feedback
      ON feedback.subscription_id = membership.id AND feedback.deleted_at IS NULL
    WHERE membership.account_id = ${myId()} AND membership.deleted_at IS NULL
      AND (membership.cancel_at_period_end = ${true}
        OR (membership.status = ${'ended'} AND membership.canceled_at IS NOT NULL))
    ORDER BY membership.updated_at DESC LIMIT 1
  `
  );
  const row = () => query.rows()[0];
  const saved = (): CancellationFeedback | null => {
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
          onSave={(answer) => save(id, answer)}
        />
      )}
    </Show>
  );
}
