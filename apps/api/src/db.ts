import { SqlClientImplPgliteHttp } from '@gamezilla/lib/sql-client/impl-pglite-http';
import { SqlClientImplPlanetScalePostgres } from '@gamezilla/lib/sql-client/impl-planetscale-postgres';
import { SqlClient } from '@gamezilla/lib/sql-client/interface';

let db: SqlClient | null = null;

export function getDb(databaseUrl: string): SqlClient {
  db ??= databaseUrl.startsWith('http')
    ? new SqlClientImplPgliteHttp(databaseUrl)
    : new SqlClientImplPlanetScalePostgres(databaseUrl);
  return db;
}
