/** Directory + OAuth client reads/writes against the IdP's own tables. */

import { raw, sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import type {
  IdpAccount,
  IdpAccountDraft,
  IdpClient,
  IdpProviderKind,
} from '../../shared/types';
import { buildAccount } from '../idp-seed';
import {
  ACCOUNT_COLUMNS,
  bindBool,
  CLIENT_COLUMNS,
  encodeJson,
  mapAccount,
  mapClient,
} from './codec';

type Row = Record<string, unknown>;

/** The directory, alphabetically — the order the chooser and hints show. */
export async function selectAccounts(db: SqlTx): Promise<IdpAccount[]> {
  const rows = await db.query(
    sql<Row>`SELECT ${raw(ACCOUNT_COLUMNS)} FROM idp_mock_accounts ORDER BY email`
  );
  return rows.map(mapAccount);
}

export async function selectAccountBySub(
  db: SqlTx,
  sub: string
): Promise<IdpAccount | null> {
  const rows = await db.query(
    sql<Row>`SELECT ${raw(ACCOUNT_COLUMNS)} FROM idp_mock_accounts WHERE id = ${sub}`
  );
  const row = rows[0];
  return row === undefined ? null : mapAccount(row);
}

export async function selectAccountByEmail(
  db: SqlTx,
  email: string
): Promise<IdpAccount | null> {
  const needle = email.trim().toLowerCase();
  const rows = await db.query(
    sql<Row>`SELECT ${raw(ACCOUNT_COLUMNS)} FROM idp_mock_accounts WHERE email = ${needle}`
  );
  const row = rows[0];
  return row === undefined ? null : mapAccount(row);
}

async function insertAccount(db: SqlTx, account: IdpAccount): Promise<void> {
  await db.run(
    sql`INSERT INTO idp_mock_accounts (id, email, email_verified, name, given_name, family_name, picture, hd, real_user_status)
      VALUES (
        ${account.sub}, ${account.email}, ${bindBool(account.emailVerified)},
        ${account.name}, ${account.givenName}, ${account.familyName},
        ${account.picture}, ${account.hd}, ${account.realUserStatus}
      )`
  );
}

async function updateAccount(db: SqlTx, account: IdpAccount): Promise<number> {
  const result = await db.run(
    sql`UPDATE idp_mock_accounts SET
      email = ${account.email},
      email_verified = ${bindBool(account.emailVerified)},
      name = ${account.name},
      given_name = ${account.givenName},
      family_name = ${account.familyName},
      picture = ${account.picture},
      hd = ${account.hd},
      real_user_status = ${account.realUserStatus}
      WHERE id = ${account.sub}`
  );
  return result.changes;
}

/** Replace (or insert) a directory entry. */
export async function upsertAccount(
  db: SqlTx,
  provider: IdpProviderKind,
  draft: IdpAccountDraft
): Promise<IdpAccount> {
  const account = buildAccount(provider, draft);
  const changed = await updateAccount(db, account);
  if (changed === 0) await insertAccount(db, account);
  return account;
}

/**
 * Insert a directory entry only when the subject is unknown. Boot seeding uses
 * this so a restart never rewrites an account someone edited by hand.
 */
export async function seedAccount(
  db: SqlTx,
  provider: IdpProviderKind,
  draft: IdpAccountDraft
): Promise<IdpAccount> {
  const account = buildAccount(provider, draft);
  const existing = await selectAccountBySub(db, account.sub);
  if (existing === null) await insertAccount(db, account);
  return existing ?? account;
}

export async function deleteAccount(db: SqlTx, sub: string): Promise<void> {
  await db.run(sql`DELETE FROM idp_mock_accounts WHERE id = ${sub}`);
}

export async function selectClients(db: SqlTx): Promise<IdpClient[]> {
  const rows = await db.query(
    sql<Row>`SELECT ${raw(CLIENT_COLUMNS)} FROM idp_mock_clients ORDER BY id`
  );
  return rows.map(mapClient);
}

export async function selectClient(
  db: SqlTx,
  clientId: string
): Promise<IdpClient | null> {
  const rows = await db.query(
    sql<Row>`SELECT ${raw(CLIENT_COLUMNS)} FROM idp_mock_clients WHERE id = ${clientId}`
  );
  const row = rows[0];
  return row === undefined ? null : mapClient(row);
}

export async function writeClient(
  db: SqlTx,
  client: IdpClient
): Promise<IdpClient> {
  const redirectUris = encodeJson(client.redirectUris);
  const apple = client.apple === undefined ? null : encodeJson(client.apple);
  const updated = await db.run(
    sql`UPDATE idp_mock_clients SET
      client_secret = ${client.clientSecret},
      redirect_uris = ${redirectUris},
      app_name = ${client.appName},
      apple = ${apple}
      WHERE id = ${client.clientId}`
  );
  if (updated.changes === 0) {
    await db.run(
      sql`INSERT INTO idp_mock_clients (id, client_secret, redirect_uris, app_name, apple)
        VALUES (${client.clientId}, ${client.clientSecret}, ${redirectUris}, ${client.appName}, ${apple})`
    );
  }
  return client;
}
