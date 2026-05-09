/**
 * **Server authority**: Postgres patch-db is the durable source of truth for
 * synced game state. Clients hold a cache only; the library does not treat
 * client-side state as authoritative over the server.
 */
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { createPatchDbReadBatcher } from '@gamezilla/patch-db/scheduling/microtask-batcher';
import { VisibilityPolicyRegistry } from '@gamezilla/patch-db/policy/visibility-policy-registry';
import {
  DEFAULT_PATCH_DB_VISIBILITY_POLICIES,
  type AppAuthContext,
} from './abac-policies';
import { createGamezillaCompactionPolicyRegistry } from './default-compaction-policies';

const uninstallByDb = new WeakMap<PatchDb, () => void>();

/**
 * Registers gamezilla's default ABAC visibility policies on {@link PatchDb.hooks}.
 * Idempotent per db instance.
 */
export function installDefaultPatchDbPolicies(db: PatchDb): () => void {
  const existing = uninstallByDb.get(db);
  if (existing !== undefined) return existing;
  const reg = new VisibilityPolicyRegistry<AppAuthContext>();
  reg.registerAll(DEFAULT_PATCH_DB_VISIBILITY_POLICIES);
  const off = reg.install(db);
  const all = () => {
    off();
    uninstallByDb.delete(db);
  };
  uninstallByDb.set(db, all);
  return all;
}

export type { AppAuthContext };

/**
 * Builds a request-scoped {@link PatchDb} (Postgres + read batcher + policies).
 */
export function createRequestPatchDb(sqlClient: SqlClient): PatchDb {
  const compaction = createGamezillaCompactionPolicyRegistry();
  const innerPostgres = new PatchDbImplPostgres(sqlClient, {
    autoCompactOnWrite: true,
    compactionPolicy: compaction.resolve,
  });
  installDefaultPatchDbPolicies(innerPostgres);
  return createPatchDbReadBatcher(innerPostgres);
}
