import { requireInMutation } from '@libs/permissions-shared/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';
import { eraseAccount, withdrawAccount } from './messages';

export const confirmAccountDeletionMutation = defineMutation({
  name: 'confirmAccountDeletion',
  args: z.object({ confirmed: z.literal(true) }),
  requiresOnline: true,
  pendingUx: 'pending',
  async run(ctx) {
    await requireInMutation(ctx, PERMISSION.profileDeleteAccount);
    const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
    const now = new Date(nowMs).toISOString();
    const eraseBy = new Date(nowMs + 30 * 86_400_000).toISOString();
    await ctx.tx.run(sql`
      INSERT INTO profile_account_privacy (id, owner_id, deletion_at, erase_by, export_status, cancellation_status)
      VALUES (${ctx.env.actorId}, ${ctx.env.actorId}, ${now}, ${eraseBy}, ${'Expired'}, ${'pending'})
      ON CONFLICT (owner_id) DO UPDATE SET deletion_at = ${now}, erase_by = ${eraseBy}, export_status = ${'Expired'}, export_detail = ${null}, export_summary = ${null}, cancellation_status = ${'pending'}
    `);
    if (ctx.env.serverNow !== undefined) {
      await ctx.tx.run(sql`
        INSERT INTO profile_deletion_receipts (id, owner_id, confirmed_at, erase_by)
        VALUES (${ctx.env.actorId}, ${ctx.env.actorId}, ${now}, ${eraseBy})
        ON CONFLICT (owner_id) DO NOTHING
      `);
    }
    const outbox = new Outbox(ctx);
    await outbox.send({
      id: ctx.env.createId(),
      message: withdrawAccount({ accountId: ctx.env.actorId }),
    });
    const erasureId = ctx.env.createId();
    await outbox.send({
      id: erasureId,
      message: eraseAccount({ accountId: ctx.env.actorId }),
    });
    await ctx.tx.run(
      sql`UPDATE outbox_events SET available_at = ${eraseBy} WHERE id = ${erasureId}`
    );
  },
});
