import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { getDb } from './db';

let db: PatchDbImplPostgres | null = null;

export function getPatchDb(databaseUrl: string): PatchDbImplPostgres {
  db ??= new PatchDbImplPostgres(getDb(databaseUrl));
  return db;
}
