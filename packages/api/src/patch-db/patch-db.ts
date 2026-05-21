/**
 * **Server authority**: Postgres patch-db is the durable source of truth for
 * synced game state. Clients hold a cache only; the library does not treat
 * client-side state as authoritative over the server.
 */
import type { SqlClient } from '@gamezilla/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { VisibilityPolicyRegistry } from '@gamezilla/patch-db/policy/visibility-policy-registry';
import { createPatchDbReadBatcher } from '@gamezilla/patch-db/scheduling/microtask-batcher';
import { createMemberOfSpaceIdsEnricher } from '@gamezilla/spaces/server/enrich-member-of-space-ids';
import {
  DEFAULT_PATCH_DB_VISIBILITY_POLICIES,
  type AppAuthContext,
} from './abac-policies';
import { createGamezillaCompactionPolicyRegistry } from './default-compaction-policies';
import { APP_SNAPSHOT_INDEXES } from './snapshot-indexes';

const uninstallByDb = new WeakMap<PatchDb, () => void>();

/**
 * Registers gamezilla's default ABAC visibility policies on {@link PatchDb.hooks}.
 * Idempotent per db instance. Also wires the lazy `member-of-space-ids`
 * enricher so visibility policies see fresh memberships without forcing the
 * session middleware to fetch them up-front on every request.
 */
export function installDefaultPatchDbPolicies(db: PatchDb): () => void {
  const existing = uninstallByDb.get(db);
  if (existing !== undefined) return existing;
  const reg = new VisibilityPolicyRegistry<AppAuthContext>();
  reg.registerAll(DEFAULT_PATCH_DB_VISIBILITY_POLICIES);
  const offEnrich = db.hooks.enrichContext(createMemberOfSpaceIdsEnricher(db));
  const offPolicies = reg.install(db);
  const all = () => {
    offEnrich();
    offPolicies();
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
    indexes: APP_SNAPSHOT_INDEXES,
  });
  installDefaultPatchDbPolicies(innerPostgres);
  return createPatchDbReadBatcher(innerPostgres);
}
