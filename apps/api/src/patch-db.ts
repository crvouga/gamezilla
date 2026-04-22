import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import { getDb } from './db';
import { Env } from './env';

let db: PatchDbImplPostgres | null = null;

export function getPatchDb(env: Env): PatchDbImplPostgres {
  db ??= new PatchDbImplPostgres(getDb(env));
  return db;
}
