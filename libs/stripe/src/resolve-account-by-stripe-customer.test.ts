import { EXTERNAL_ACCOUNT_PROVIDER_STRIPE } from '@libs/auth/shared/external-account-providers';
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { describe, expect, it, mock } from 'bun:test';

import { resolveAccountIdByStripeCustomerId } from './resolve-account-by-stripe-customer';

describe('resolveAccountIdByStripeCustomerId', () => {
  it('queries the Stripe external account and returns its user id', async () => {
    const query = mock(async () => [{ user_id: 'user-123' }]);
    const sql = { query } as unknown as SqlClient;

    const accountId = await resolveAccountIdByStripeCustomerId(sql, 'cus_123');

    expect(accountId).toBe('user-123');
    expect(query).toHaveBeenCalledTimes(1);
    const [statement] = query.mock.calls[0] as unknown as [Sql];
    expect(statement.sql).toContain('FROM external_accounts');
    expect(statement.sql).toContain('provider = ?');
    expect(statement.sql).toContain('external_id = ?');
    expect(statement.values).toEqual([
      EXTERNAL_ACCOUNT_PROVIDER_STRIPE,
      'cus_123',
    ]);
  });

  it('returns null when no Stripe external account exists', async () => {
    const sql = {
      query: async () => [],
    } as unknown as SqlClient;

    await expect(
      resolveAccountIdByStripeCustomerId(sql, 'cus_missing')
    ).resolves.toBeNull();
  });
});
