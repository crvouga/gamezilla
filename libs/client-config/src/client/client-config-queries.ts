import {
  ClientConfigCol,
  CLIENT_CONFIG_TABLE,
} from '@libs/db/shared/client-config-tables';
import { sql, type Sql, ident } from '@pkgs/sql';

export function clientConfigRowQuery(id: string): Sql {
  return sql`SELECT ${ident(ClientConfigCol.googleWebClientId)} AS google_web_client_id
 FROM ${ident(CLIENT_CONFIG_TABLE.tableName)}
 WHERE ${ident(ClientConfigCol.id)} = ${id}`;
}
