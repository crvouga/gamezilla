import type { NameLookup } from '@pkgs/observability-shared/identity-resolver';
import { normalizePersonName } from '@pkgs/observability-shared/person-name';
import sql, { ident } from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

type IdRow = { readonly id: string };

/**
 * Display names live on `idp_users.name` and `idp_accounts.name`. The compared
 * value is already normalized; the whitespace pattern is a bound parameter.
 * `obs_read` (libs/infra-shared/tofu) is the only role granted these reads.
 */
export function peopleByName(db: SqlClient): NameLookup {
  return async (value) => {
    const name = normalizePersonName(value);
    const users = await namedIds(db, 'idp_users', 'id', name);
    const accounts = await namedIds(db, 'idp_accounts', 'user_id', name);
    return [...new Set([...users, ...accounts])];
  };
}

async function namedIds(
  db: SqlClient,
  table: 'idp_users' | 'idp_accounts',
  column: 'id' | 'user_id',
  name: string
): Promise<readonly string[]> {
  const rows = await db.query(sql<IdRow>`
    SELECT ${ident(column)} AS id
    FROM ${ident(table)}
    WHERE lower(regexp_replace(btrim(name), ${'\\s+'}, ' ', 'g')) = ${name}
      AND deleted_at IS NULL
    LIMIT 20
  `);
  return rows.map((row) => row.id);
}
