import { describe, expect, test } from 'bun:test';
import { PubsubSecretName as Name } from '@libs/pubsub/public/secret-names';
import {
  deleteStaleApiKeys,
  resolveEmqxCredentials,
} from '@libs/pubsub/shared/provision/emqx-broker-credentials';
import { COMMITTED_EMQX_CREDENTIALS } from '@libs/pubsub/shared/secrets/emqx-credentials';
import type { HttpClient } from '@pkgs/http-client';

const hex = (bytes: number) => 'ab'.repeat(bytes);

describe('resolveEmqxCredentials', () => {
  test('keeps strong stored credentials', () => {
    const stored = new Map([
      [Name.apiKey, 'gamezilla-live'],
      [Name.apiSecret, 's'.repeat(64)],
      [Name.jwtSecret, 'j'.repeat(64)],
      [Name.dashboardPassword, 'd'.repeat(48)],
    ]);
    const { credentials, rotated } = resolveEmqxCredentials(stored, hex);
    expect(rotated).toEqual([]);
    expect(credentials.apiKey).toBe('gamezilla-live');
  });

  test('mints every missing or committed credential', () => {
    const [committed] = [...COMMITTED_EMQX_CREDENTIALS];
    const stored = new Map([[Name.apiKey, committed ?? '']]);
    const { credentials, rotated } = resolveEmqxCredentials(stored, hex);
    expect(rotated).toEqual([
      Name.apiKey,
      Name.apiSecret,
      Name.jwtSecret,
      Name.dashboardPassword,
    ]);
    for (const value of Object.values(credentials)) {
      expect(COMMITTED_EMQX_CREDENTIALS.has(value)).toBe(false);
    }
    expect(credentials.apiSecret).toHaveLength(64);
  });
});

describe('deleteStaleApiKeys', () => {
  test('deletes every key except the provisioned one', async () => {
    const deleted: string[] = [];
    const http: HttpClient = {
      async fetch(input, init) {
        const url = String(input);
        if (url.endsWith('/api/v5/login')) return Response.json({ token: 't' });
        if (init?.method === 'DELETE') {
          deleted.push(decodeURIComponent(url.split('/').pop() ?? ''));
          return new Response(null, { status: 204 });
        }
        return Response.json([
          { name: 'old', api_key: 'pubsub-test' },
          { name: 'current', api_key: 'gamezilla-live' },
        ]);
      },
    };
    const removed = await deleteStaleApiKeys(http, 'https://broker', {
      apiKey: 'gamezilla-live',
      apiSecret: 's',
      jwtSecret: 'j',
      dashboardPassword: 'd',
    });
    expect(removed).toEqual(['old']);
    expect(deleted).toEqual(['old']);
  });
});
