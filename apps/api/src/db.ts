import { SqlClientImplPgliteHttp } from '@gamezilla/shared/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/shared/sql-client/impl-planetscale-postgres';
import { SqlClient } from '@gamezilla/shared/sql-client/interface';

let db: SqlClient | null = null;

export function getDb(databaseUrl: string): SqlClient {
  db ??= databaseUrl.startsWith('http')
    ? new SqlClientImplPgliteHttp(databaseUrl)
    : new SqlClientImplPlanetScalePostgres(databaseUrl);
  return db;
}
