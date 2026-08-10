import { type Sql, sql } from '@pkgs/sql';
import type { ClientConfigDbRow } from '../shared/parse-client-config';

export type ClientConfigRow = ClientConfigDbRow;

export function clientConfigRowsQuery(): Sql<ClientConfigRow> {
  return sql<ClientConfigRow>`
    SELECT id, value, deleted_at
    FROM client_config
    WHERE deleted_at IS NULL
  `;
}
