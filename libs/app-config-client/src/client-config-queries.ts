import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';
import type { ClientConfigDbRow } from '@libs/app-config-shared/parse-client-config';

export type ClientConfigRow = ClientConfigDbRow;

export function clientConfigRowsQuery(): Sql<ClientConfigRow> {
  return sql<ClientConfigRow>`
    SELECT id, value, deleted_at
    FROM client_config
    WHERE deleted_at IS NULL
  `;
}
