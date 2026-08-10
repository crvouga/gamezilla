import { describe, expect, test } from 'bun:test';

import {
  buildLinkedProviders,
  readLinkedProviderField,
} from './linked-account-providers';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const AUTH_USER_ID = 'user_external_1';
const CREATED_AT = '2026-01-01T00:00:00.000Z';
const PRIMARY_AUTH_PROVIDER = 'primary';

describe('linked-account-providers', () => {
  test('builds primary auth row from external_accounts', () => {
    const rows = buildLinkedProviders({
      accountId: ACCOUNT_ID,
      primaryAuthProvider: PRIMARY_AUTH_PROVIDER,
      primaryAuthExternalAccount: {
        externalId: AUTH_USER_ID,
        metadata: { email: 'alice@example.com' },
        createdAt: CREATED_AT,
      },
      authSnapshotData: { id: AUTH_USER_ID, accounts: [] },
      entityCreatedAt: CREATED_AT,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: `${ACCOUNT_ID}:${PRIMARY_AUTH_PROVIDER}:${AUTH_USER_ID}`,
      accountId: ACCOUNT_ID,
      provider: PRIMARY_AUTH_PROVIDER,
      providerUserId: AUTH_USER_ID,
      email: 'alice@example.com',
      linkedAt: CREATED_AT,
    });
  });

  test('includes oauth rows from auth snapshot JSON', () => {
    const rows = buildLinkedProviders({
      accountId: ACCOUNT_ID,
      primaryAuthProvider: PRIMARY_AUTH_PROVIDER,
      primaryAuthExternalAccount: {
        externalId: AUTH_USER_ID,
        metadata: '{}',
        createdAt: CREATED_AT,
      },
      authSnapshotData: {
        id: AUTH_USER_ID,
        email: 'alice@example.com',
        accounts: [
          {
            id: 'acc_oauth_1',
            providerId: 'google',
            accountId: 'google-user-1',
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      },
      entityCreatedAt: CREATED_AT,
    });

    expect(rows).toHaveLength(2);
    expect(rows[1]?.provider).toBe('google');
    expect(rows[1]?.providerUserId).toBe('google-user-1');
    expect(rows[1]?.email).toBe('alice@example.com');
  });

  test('readLinkedProviderField resolves column by stable id', () => {
    const sources = {
      accountId: ACCOUNT_ID,
      primaryAuthProvider: PRIMARY_AUTH_PROVIDER,
      primaryAuthExternalAccount: {
        externalId: AUTH_USER_ID,
        metadata: { email: 'a@b.c' },
        createdAt: CREATED_AT,
      },
      authSnapshotData: { id: AUTH_USER_ID, accounts: [] },
      entityCreatedAt: CREATED_AT,
    };

    const id = `${ACCOUNT_ID}:${PRIMARY_AUTH_PROVIDER}:${AUTH_USER_ID}`;
    expect(readLinkedProviderField(id, 'email', sources)).toBe('a@b.c');
    expect(readLinkedProviderField(id, 'provider', sources)).toBe(
      PRIMARY_AUTH_PROVIDER
    );
  });

  test('returns empty list when primary auth external_account is missing', () => {
    expect(
      buildLinkedProviders({
        accountId: ACCOUNT_ID,
        primaryAuthProvider: PRIMARY_AUTH_PROVIDER,
        primaryAuthExternalAccount: null,
        authSnapshotData: null,
        entityCreatedAt: null,
      })
    ).toEqual([]);
  });
});
