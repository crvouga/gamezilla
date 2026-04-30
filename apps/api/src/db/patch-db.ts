import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { installDefaultPatchDbPolicies } from '@gamezilla/patch-db/policy/install-default-patch-db-policies';
import { getDb } from './sql-client';

let db: PatchDbImplPostgres | null = null;

export function getPatchDb(databaseUrl: string): PatchDbImplPostgres {
  if (db === null) {
    db = new PatchDbImplPostgres(getDb(databaseUrl));
    installDefaultPatchDbPolicies(db);
  }
  return db;
}
