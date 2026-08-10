import type { SqlClient } from '@pkgs/sql-client/interface';
import { CLIENT_CONFIG_ENTITY_ID } from '../shared/client-config-entities';
import { clientConfigRowQuery } from './client-config-queries';

export type ClientRuntimeConfig = {
  googleWebClientId: string | null;
};

export class ClientRuntimeConfigReader {
  constructor(private readonly db: SqlClient) {}

  async read(): Promise<ClientRuntimeConfig> {
    const rows = await this.db.query(
      clientConfigRowQuery(CLIENT_CONFIG_ENTITY_ID)
    );
    const row = rows[0];
    if (row === undefined) {
      return { googleWebClientId: null };
    }
    const googleRaw = row.google_web_client_id;
    const googleId =
      typeof googleRaw === 'string' && googleRaw.length > 0 ? googleRaw : null;
    return { googleWebClientId: googleId };
  }
}
