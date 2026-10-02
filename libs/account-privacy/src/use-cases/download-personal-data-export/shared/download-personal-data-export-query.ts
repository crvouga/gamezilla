import { decideInQuery } from '@libs/permissions/public/query-permission';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { decidePrivacyAccess } from '@libs/permissions/public/privacy-permission';
import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

export const downloadPersonalDataExport = defineQuery({
  name: 'downloadPersonalDataExport',
  params: z.object({ accountId: z.string().min(1) }),
  sampleParams: { accountId: 'account' },
  authorize: async (ctx, { accountId }) => {
    if (accountId !== ctx.env.actorId) return false;
    const decision = decidePrivacyAccess(await decideInQuery(ctx, PERMISSION.profileExportData), { connected: true, authenticatedAtMs: ctx.env.authenticatedAtMs ?? null, nowMs: ctx.env.now().getTime() });
    return decision.allowed;
  },
  async run(ctx, { accountId }) {
    const cutoff = new Date(ctx.env.now().getTime() - 7 * 86_400_000).toISOString();
    return { profile_account_privacy: await ctx.db.query(sql`
      SELECT * FROM profile_account_privacy
      WHERE owner_id = ${accountId} AND deletion_at IS NULL AND export_status = ${'Ready'} AND ready_at > ${cutoff}
    `) };
  },
});
