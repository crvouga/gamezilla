import { sql, type Sql } from '@pkgs/sql';

export type ClientConfigRow = {
  readonly google_web_client_id: string | null;
};

export function clientConfigRowQuery(id: string): Sql<ClientConfigRow> {
  return sql<ClientConfigRow>`
    SELECT google_web_client_id
    FROM client_config
    WHERE id = ${id}
  `;
}
