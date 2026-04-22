import { SqlClientImplPgliteHttp } from '@gamezilla/shared/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/shared/sql-client/impl-planetscale-postgres';
import { SqlClient } from '@gamezilla/shared/sql-client/interface';
import { Env } from './env';

let db: SqlClient | null = null;
export function getDb(env: Env): SqlClient {
  db ??= env.DATABASE_URL.startsWith('http')
    ? new SqlClientImplPgliteHttp(env.DATABASE_URL)
    : new SqlClientImplPlanetScalePostgres(env.DATABASE_URL);
  return db;
}
