import type { SqlClient } from '@pkgs/sql-client/interface';
import { CLIENT_CONFIG_ENTITY_ID } from '../shared/client-config-entities';
import {
  ClientConfigCol,
  CLIENT_CONFIG_TABLE,
} from '@libs/db/shared/client-config-tables';

export type ClientRuntimeConfig = {
  googleWebClientId: string | null;
};

export async function readClientRuntimeConfig(
  sql: SqlClient
): Promise<ClientRuntimeConfig> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT ${ClientConfigCol.googleWebClientId}
     FROM ${CLIENT_CONFIG_TABLE.tableName}
     WHERE ${ClientConfigCol.id} = ? LIMIT 1`,
    [CLIENT_CONFIG_ENTITY_ID]
  );
  const row = rows[0];
  if (row === undefined) {
    return { googleWebClientId: null };
  }
  const googleRaw = row[ClientConfigCol.googleWebClientId];
  const googleId =
    typeof googleRaw === 'string' && googleRaw.length > 0 ? googleRaw : null;
  return { googleWebClientId: googleId };
}
