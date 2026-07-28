import { honey } from '@pkgs/sql';
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
  db: SqlClient
): Promise<ClientRuntimeConfig> {
  const rows = await db.query<Record<string, unknown>>(
    honey({
      select: [ClientConfigCol.googleWebClientId],
      from: CLIENT_CONFIG_TABLE.tableName,
      where: ['=', ClientConfigCol.id, CLIENT_CONFIG_ENTITY_ID],
      limit: 1,
    })
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
