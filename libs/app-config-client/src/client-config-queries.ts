import type { ClientConfigDbRow } from '@libs/app-config-shared/parse-client-config';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import sql from '@pkgs/sql-root-shared/sql';

export type ClientConfigRow = ClientConfigDbRow;

export function clientConfigRowsQuery(): Sql<ClientConfigRow> {
  return sql<ClientConfigRow>`
    SELECT id, value, deleted_at
    FROM client_config
    WHERE deleted_at IS NULL
  `;
}
