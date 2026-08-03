import { sql, type Sql } from '@pkgs/sql';

export function clientConfigRowQuery(id: string): Sql {
  return sql`
    SELECT google_web_client_id
    FROM client_config
    WHERE id = ${id}
  `;
}
