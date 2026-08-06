import { describe, expect, test } from 'bun:test';
import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';

import type { ConfigService } from '@libs/auth/client/config-service-types';

import { uploadSyncBatch, type SyncClientAuth } from './sync-api';

function fakeConfig(): ConfigService {
  return {
    getApiUrl: () => 'https://api.test',
  } as unknown as ConfigService;
}

const AUTH: SyncClientAuth = {
  getAccountId: () => 'account-1',
  getDeviceId: () => 'device-1',
  getSessionToken: () => 'token',
};

describe('uploadSyncBatch discard protocol', () => {
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
      auth: AUTH,
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
        auth: AUTH,
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
