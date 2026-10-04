import { requireInMutation } from '@libs/permissions-shared/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';
import { prepareExport } from './messages';

export const requestPersonalDataExportMutation = defineMutation({
  name: 'requestPersonalDataExport',
  args: z.object({}),
  requiresOnline: true,
  pendingUx: 'pending',
  async run(ctx) {
    await requireInMutation(ctx, PERMISSION.profileExportData);
    const now = (ctx.env.serverNow ?? ctx.env.now)().toISOString();
    await ctx.tx.run(sql`
      INSERT INTO profile_account_privacy (id, owner_id, export_status, requested_at, export_detail, export_summary)
      VALUES (${ctx.env.actorId}, ${ctx.env.actorId}, ${'Preparing'}, ${now}, ${null}, ${null})
      ON CONFLICT (owner_id) DO UPDATE SET export_status = ${'Preparing'}, requested_at = ${now}, ready_at = ${null}, export_detail = ${null}, export_summary = ${null}
    `);
    const eventId = ctx.env.createId();
    await new Outbox(ctx).send({
      id: eventId,
      message: prepareExport({ accountId: ctx.env.actorId }),
    });
    await ctx.tx.run(
      sql`UPDATE outbox_events SET available_at = ${new Date((ctx.env.serverNow ?? ctx.env.now)().getTime() + 1_000).toISOString()} WHERE id = ${eventId}`
    );
  },
});
