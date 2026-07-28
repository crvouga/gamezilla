import {
  ClientConfigCol,
  CLIENT_CONFIG_TABLE,
} from '@libs/db/shared/client-config-tables';
import { raw, sql, type Sql } from '@pkgs/sql';

export function clientConfigRowQuery(id: string): Sql {
  return sql`SELECT ${raw(ClientConfigCol.googleWebClientId)} AS google_web_client_id
 FROM ${raw(CLIENT_CONFIG_TABLE.tableName)}
 WHERE ${raw(ClientConfigCol.id)} = ${id}`;
}
