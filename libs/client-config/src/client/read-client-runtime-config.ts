import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { CLIENT_CONFIG_ENTITY_ID } from '../shared/client-config-entities';

export type ClientRuntimeConfig = {
  googleWebClientId: string | null;
};

export async function readClientRuntimeConfig(
  db: SqlClient
): Promise<ClientRuntimeConfig> {
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT google_web_client_id
    FROM client_config
    WHERE id = ${CLIENT_CONFIG_ENTITY_ID}
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) {
    return { googleWebClientId: null };
  }
  const googleRaw = row['google_web_client_id'];
  const googleId =
    typeof googleRaw === 'string' && googleRaw.length > 0 ? googleRaw : null;
  return { googleWebClientId: googleId };
}
