import { SESSION_TOKEN_KEY } from '@libs/auth-shared/auth-storage-keys';
import { HARNESS_APPLE_CLIENT_ID } from '@libs/feature-shared/harness-constants';
import sql from '@pkgs/sql-shared/sql';
import type { ProductHarness } from './harness';
import { harnessIdpAccountId } from './idp';

/** All product accounts, including ones whose devices have signed out. */
export async function registeredAccounts(s: ProductHarness): Promise<string[]> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{ id: string }>`
    SELECT id FROM auth_users WHERE is_anon = FALSE AND deleted_at IS NULL
    ORDER BY created_at, id
  `);
  return rows.map((row) => row.id);
}

/** The account an outside identity belongs to, independent of its device. */
export async function outsideIdentityAccount(
  s: ProductHarness,
  provider: string,
  address: string
): Promise<string | null> {
  const subject =
    provider === 'apple'
      ? (
          await s.harness.idps.apple.runtime
            .instance()
            .grant(HARNESS_APPLE_CLIENT_ID, harnessIdpAccountId(address))
        )?.subject
      : harnessIdpAccountId(address);
  if (subject === undefined) return null;
  const rows = await s.harness.serverSql.sqlClient.query(sql<{ id: string }>`
    SELECT a.user_id AS id FROM idp_accounts i
    JOIN auth_external_accounts a ON a.external_id = i.user_id
    WHERE i.provider = ${provider}
      AND i.provider_user_id = ${subject}
      AND a.provider = 'idp' AND a.deleted_at IS NULL
  `);
  if (rows.length > 1)
    throw new Error('Outside identity belongs to multiple accounts');
  return rows[0]?.id ?? null;
}

/** The device's cached signed-in state; revocation becomes visible on reconnect. */
export async function deviceShowsSignedIn(
  s: ProductHarness,
  device: string
): Promise<boolean> {
  const env = await s.harness.client(device);
  const token = env.secureStorage.getValue(SESSION_TOKEN_KEY);
  return typeof token === 'string' && token.length > 0;
}
