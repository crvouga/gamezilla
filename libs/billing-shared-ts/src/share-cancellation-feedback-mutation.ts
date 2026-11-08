import { requireInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import {
  CANCELLATION_COMMENT_LIMIT,
  CANCELLATION_REASONS,
} from './cancellation-feedback';

/** Own-account, idempotent feedback; it never modifies the membership. */
export const shareCancellationFeedbackMutation = defineMutation({
  name: 'shareCancellationFeedback',
  args: z.object({
    subscriptionId: z.string().min(1),
    reason: z.enum(CANCELLATION_REASONS),
    comment: z.string().max(CANCELLATION_COMMENT_LIMIT),
  }),
  async run(ctx, args) {
    await requireInMutation(ctx, PERMISSION.billingManage);
    const [membership] = await ctx.tx.query(sql<{ id: string }>`
      SELECT id FROM billing_subscriptions
      WHERE id = ${args.subscriptionId} AND account_id = ${ctx.env.actorId}
        AND deleted_at IS NULL
        AND (cancel_at_period_end = ${true} OR canceled_at IS NOT NULL)
    `);
    if (membership === undefined) {
      throw new MutationError(
        'CANCELLATION_REQUIRED',
        'Feedback is available after canceling your membership. Your cancellation is unchanged.'
      );
    }
    await ctx.tx.run(sql`
      INSERT INTO billing_cancellation_feedback (id, account_id, subscription_id, reason, comment)
      VALUES (${args.subscriptionId}, ${ctx.env.actorId}, ${args.subscriptionId}, ${args.reason}, ${args.comment})
      ON CONFLICT (id) DO UPDATE SET reason = EXCLUDED.reason, comment = EXCLUDED.comment
      WHERE billing_cancellation_feedback.account_id = ${ctx.env.actorId}
        AND billing_cancellation_feedback.deleted_at IS NULL
    `);
  },
});
