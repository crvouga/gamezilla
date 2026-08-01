import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';

import type { ConfigService } from '@libs/auth/client/config-service-types';

function fakeConfig(): ConfigService {
  return {
    getApiUrl: () => 'https://api.test',
  } as unknown as ConfigService;
}

describe('uploadSyncBatch discard protocol', () => {
  let uploadSyncBatch: typeof import('./sync-api').uploadSyncBatch;

  beforeAll(async () => {
    await mock.module('@libs/auth/client/use-current-account-id', () => ({
      getCachedCurrentAccountId: () => 'account-1',
    }));
    await mock.module('@libs/auth/client/use-device-id', () => ({
      getCachedDeviceId: () => 'device-1',
    }));
    await mock.module('@libs/auth/client/use-fresh-auth-token', () => ({
      getCachedAuthToken: () => 'token',
    }));
    ({ uploadSyncBatch } = await import('./sync-api'));
  });

  test('409 with discard:true resolves without throw (connector can complete)', async () => {
    const fetchFn = async () =>
      new Response(
        JSON.stringify({
          discard: true,
          failures: [{ code: 'PROFILE_ID_MISMATCH' }],
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );

    await uploadSyncBatch({
      config: fakeConfig(),
      fetchFn,
      batch: {
        rows: [
          {
            op: 'patch',
            table: PROFILES_TABLE.tableName,
            id: 'account-1',
            values: { [ProfileCol.avatarConfig]: '{}' },
          },
        ],
      },
    });
  });

  test('5xx throws so the SDK retries', async () => {
    const fetchFn = async () => new Response('boom', { status: 503 });
    await expect(
      uploadSyncBatch({
        config: fakeConfig(),
        fetchFn,
        batch: {
          rows: [
            {
              op: 'patch',
              table: PROFILES_TABLE.tableName,
              id: 'account-1',
              values: { [ProfileCol.avatarConfig]: '{}' },
            },
          ],
        },
      })
    ).rejects.toThrow(/503/);
  });
});
