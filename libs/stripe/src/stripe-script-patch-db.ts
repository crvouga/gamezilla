import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import type { PatchDbSystemContext } from '@gamezilla/patch-db/interface';
import { PatchDbCompactionPolicyRegistry } from '@gamezilla/patch-db/policy/compaction-policy';

/** System context for Stripe CLI sync scripts (catalog dump + entity backfills). */
export const STRIPE_PATCH_DB_SCRIPT_CONTEXT: PatchDbSystemContext = {
  deviceId: null,
  reason: 'stripe-sync',
};

/**
 * Patch-db for scripts: tight compaction (`keepLatest: 1`) so each entity behaves
 * like a single-row snapshot after writes.
 */
export function createStripeScriptPatchDb(
  sqlClient: SqlClient
): PatchDbImplPostgres {
  const compaction = new PatchDbCompactionPolicyRegistry().setDefault({
    keepLatest: 1,
  });
  return new PatchDbImplPostgres(sqlClient, {
    autoCompactOnWrite: true,
    compactionPolicy: compaction.resolve,
  });
}
