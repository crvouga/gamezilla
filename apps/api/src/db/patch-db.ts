import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { createGamezillaCompactionPolicyRegistry } from './default-compaction-policies';
import { installDefaultPatchDbPolicies } from './install-default-patch-db-policies';
import { getDb } from './sql-client';

let db: PatchDbImplPostgres | null = null;

export function getPatchDb(databaseUrl: string): PatchDbImplPostgres {
  if (db === null) {
    const compaction = createGamezillaCompactionPolicyRegistry();
    db = new PatchDbImplPostgres(getDb(databaseUrl), {
      autoCompactOnWrite: true,
      compactionPolicy: compaction.resolve,
    });
    installDefaultPatchDbPolicies(db);
  }
  return db;
}
