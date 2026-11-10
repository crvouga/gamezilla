import { expect, test } from 'bun:test';
import { createObservatoryRoutes } from '@libs/observatory-server-ts/observatory-routes';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { observatoryFixture } from './observatory-fixture';

test('each User Observatory RPC rejects denied actors before reading anything', async () => {
  const f = await observatoryFixture();
  try {
    const checked: string[] = [];
    const app = new Hono().route(
      '/',
      createObservatoryRoutes({
        getDb: () => {
          throw new Error('Denied RPC reached the database');
        },
        ports: f.ports,
        subscriptionCredentials: () => {
          throw new Error('Denied RPC minted a subscription');
        },
        authorize: async (_request, permission) => {
          checked.push(permission);
          throw new HTTPException(403);
        },
      })
    );
    const requests = [
      { path: '/subscription', permission: PERMISSION.observatoryView },
      { path: '/live', permission: PERMISSION.observatoryView },
      {
        path: `/live/${f.createId()}/watch`,
        method: 'POST',
        permission: PERMISSION.observatoryWatch,
      },
    ];
    for (const input of requests) {
      const response = await app.request(input.path, {
        method: input.method ?? 'GET',
      });
      expect(response.status).toBe(403);
      expect(checked.at(-1)).toBe(input.permission);
    }
    expect(checked).toHaveLength(requests.length);
  } finally {
    await f.db.disconnect();
  }
});
