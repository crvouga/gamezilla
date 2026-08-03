import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { UploadBatch } from '@pkgs/sync-engine/shared/upload-batch';

import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { SyncApiFetch } from './sync-api';

function fakeConfig(): ConfigService {
  return {
    getApiUrl: () => 'https://api.test',
  } as unknown as ConfigService;
}

describe('uploadSyncBatch discard protocol', () => {
  let uploadSyncBatch: (args: {
    readonly config: ConfigService;
    readonly fetchFn: SyncApiFetch;
    readonly batch: UploadBatch;
  }) => Promise<void>;

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
            values: { avatar_config: '{}' },
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
              values: { avatar_config: '{}' },
            },
          ],
        },
      })
    ).rejects.toThrow(/503/);
  });
});
