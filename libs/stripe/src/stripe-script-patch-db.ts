import type { SqlClient } from '@pkgs/sql-client/interface';
import { PatchDbImplPostgres } from '@pkgs/patch-db/impl-postgres/impl-postgres';
import { patchDbSystemContext } from '@pkgs/patch-db/interface';
import { PatchDbCompactionPolicyRegistry } from '@pkgs/patch-db/policy/compaction-policy';

/** System context for Stripe CLI sync scripts (catalog dump + entity backfills). */
export const STRIPE_PATCH_DB_SCRIPT_CONTEXT =
  patchDbSystemContext('stripe-sync');

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
