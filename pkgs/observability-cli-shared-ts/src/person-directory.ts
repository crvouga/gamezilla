import type {
  IdentityLookup,
  NameLookup,
} from '@pkgs/observability-root-shared-ts/identity-resolver';
import { normalizePersonName } from '@pkgs/observability-root-shared-ts/person-name';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { ident, join } from '@pkgs/sql-root-shared-ts/sql';

type IdRow = { readonly id: string };

/**
 * Display names live on `idp_users.name` and `idp_accounts.name`, and email on
 * `idp_users.email`. Those rows belong to the identity provider and carry its
 * ids; a span carries the app account id (`profile.id`), which
 * `auth_external_accounts` links to the provider's user. Resolving a name or
 * an email to the provider's id would match no span at all, so every lookup
 * here ends in the app account. The compared value is already normalized; the
 * whitespace pattern is a bound parameter. `obs_read` (libs/infra-shared-ts/tofu)
 * is the only role granted these reads.
 */
export function peopleByName(db: SqlClient): NameLookup {
  return async (value) => {
    const name = normalizePersonName(value);
    const users = await namedIds(db, 'idp_users', 'id', name);
    const accounts = await namedIds(db, 'idp_accounts', 'user_id', name);
    return accountsOfIdentities(db, [...new Set([...users, ...accounts])]);
  };
}

/** The app account of the person whose provider email this is, or null. */
export function peopleByEmail(db: SqlClient): IdentityLookup {
  return async (email) => {
    const rows = await db.query(sql<IdRow>`
      SELECT id
      FROM idp_users
      WHERE lower(email) = ${email}
        AND deleted_at IS NULL
      LIMIT 1
    `);
    const identity = rows[0]?.id;
    if (identity === undefined) return null;
    return (await accountsOfIdentities(db, [identity]))[0] ?? null;
  };
}

/**
 * The app accounts signed in through these identity-provider users. A provider
 * user who never opened the app has none, and is not a person the traces know.
 */
export async function accountsOfIdentities(
  db: SqlClient,
  identities: readonly string[]
): Promise<readonly string[]> {
  if (identities.length === 0) return [];
  const rows = await db.query(sql<{ readonly user_id: string }>`
    SELECT DISTINCT user_id
    FROM auth_external_accounts
    WHERE provider = 'idp'
      AND external_id IN (${join(identities)})
      AND deleted_at IS NULL
    LIMIT 20
  `);
  return rows.map((row) => row.user_id);
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
