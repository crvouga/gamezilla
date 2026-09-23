import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

/** The caller's consumption ledger (tombstones included, per sync rules). */
export const permissionQuotaLedgerQuery = defineQuery({
  name: 'permissionQuotaLedger',
  limit: 5000,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id,
        owner_id,
        quota,
        idempotency_key,
        amount,
        consumed_at,
        policy_version,
        deleted_at
      FROM permissions_quota_ledger
      WHERE owner_id = ${ctx.env.actorId}
      ORDER BY consumed_at DESC, id ASC
    `);
    return { permissions_quota_ledger: rows };
  },
});
