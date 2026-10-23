import { describe, expect, test } from 'bun:test';
import {
  accountsOfIdentities,
  peopleByEmail,
  peopleByName,
} from '@pkgs/observability-cli-shared-ts/person-directory';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';

/**
 * Two id spaces. The identity provider names a person `idp-ada`; the app
 * (and so every span's `user.id`) names the same person `account-ada`, and
 * `auth_external_accounts` links them.
 */
const PROVIDER_USERS = [
  { id: 'idp-ada', name: 'Ada Lovelace', email: 'ada@example.test' },
  { id: 'idp-never-opened-the-app', name: 'Grace Hopper', email: null },
];
const LINKS = [{ user_id: 'account-ada', external_id: 'idp-ada' }];

function database(): Pick<SqlClient, 'query'> {
  return {
    async query<T extends Record<string, unknown>>(
      statement: Sql<T>
    ): Promise<T[]> {
      const text = statement.sql;
      const values = statement.values;
      if (text.includes('FROM auth_external_accounts')) {
        return LINKS.filter((link) => values.includes(link.external_id)).map(
          (link) => ({ user_id: link.user_id })
        ) as unknown as T[];
      }
      if (text.includes('FROM idp_users') && text.includes('email')) {
        return PROVIDER_USERS.filter((user) => values.includes(user.email)).map(
          (user) => ({ id: user.id })
        ) as unknown as T[];
      }
      if (text.includes('FROM idp_users')) {
        const wanted = String(
          values.find((v) => typeof v === 'string' && v !== '\\s+')
        );
        return PROVIDER_USERS.filter(
          (user) => user.name.toLowerCase() === wanted
        ).map((user) => ({ id: user.id })) as unknown as T[];
      }
      return [];
    },
  } as Pick<SqlClient, 'query'>;
}

describe('finding a person from the identity provider', () => {
  // regression: obs-person-name-resolves-to-provider-id
  test('a name leads to the app account the spans carry, never the provider id', async () => {
    const ids = await peopleByName(database() as SqlClient)('ada lovelace');
    expect(ids).toEqual(['account-ada']);
  });

  // regression: obs-person-name-resolves-to-provider-id
  test('an email leads to the app account too', async () => {
    expect(
      await peopleByEmail(database() as SqlClient)('ada@example.test')
    ).toBe('account-ada');
  });

  test('a provider user who never opened the app is not a person the traces know', async () => {
    expect(
      await accountsOfIdentities(database() as SqlClient, [
        'idp-never-opened-the-app',
      ])
    ).toEqual([]);
    expect(await accountsOfIdentities(database() as SqlClient, [])).toEqual([]);
  });
});
