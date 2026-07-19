import { EXTERNAL_ACCOUNT_PROVIDER_STRIPE } from '@libs/auth/shared/external-account-providers';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
} from '@libs/db/shared/external-accounts-tables';
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
    const [statement, params] = query.mock.calls[0] as unknown as [
      string,
      unknown[],
    ];
    expect(statement).toContain(`FROM ${EXTERNAL_ACCOUNTS_TABLE}`);
    expect(statement).toContain(`${ExternalAccountCol.provider} = ?`);
    expect(statement).toContain(`${ExternalAccountCol.externalId} = ?`);
    expect(params).toEqual([EXTERNAL_ACCOUNT_PROVIDER_STRIPE, 'cus_123']);
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
