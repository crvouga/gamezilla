import { expect, test } from 'bun:test';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { createPopulationRoutes } from '@libs/population-server/population-routes';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { populationFixture } from './population-fixture';

test('each administrative RPC rejects denied actors before reading or changing population data', async () => {
  const f = await populationFixture();
  try {
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    const base = `/users/${assignment.lease.userId}`;
    const checked: string[] = [];
    const app = new Hono().route(
      '/',
      createPopulationRoutes({
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
      { path: '/', permission: PERMISSION.populationView },
      { path: '/users', permission: PERMISSION.populationView },
      { path: '/workers', permission: PERMISSION.populationView },
      { path: '/subscription', permission: PERMISSION.populationView },
      { path: base, permission: PERMISSION.populationInspect },
      { path: `${base}/events`, permission: PERMISSION.populationInspect },
      {
        path: `${base}/replay`,
        method: 'POST',
        permission: PERMISSION.populationReplay,
      },
      {
        path: '/config',
        method: 'PUT',
        body: await f.repo.config(),
        permission: PERMISSION.populationConfigure,
      },
      ...(['pause', 'resume', 'restart', 'inspect'] as const).map(
        (command) => ({
          path: `${base}/commands`,
          method: 'POST',
          body: { operationId: f.createId(), command },
          permission:
            command === 'inspect'
              ? PERMISSION.populationInspect
              : PERMISSION.populationControl,
        })
      ),
    ];
    for (const input of requests) {
      const response = await app.request(input.path, {
        method: 'method' in input ? input.method : 'GET',
        headers: { 'content-type': 'application/json' },
        ...('body' in input ? { body: JSON.stringify(input.body) } : {}),
      });
      expect(response.status).toBe(403);
      expect(checked.at(-1)).toBe(input.permission);
      expect(await response.text()).not.toContain(assignment.password);
    }
    expect(checked).toHaveLength(requests.length);
  } finally {
    await f.db.disconnect();
  }
});

test('view RPC never exposes credentials or an inspect-only DOM snapshot', async () => {
  const f = await populationFixture();
  try {
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    const app = createPopulationRoutes({
      getDb: () => f.db,
      ports: f.ports,
      subscriptionCredentials: async () => ({
        username: 'jwt',
        password: 'scoped',
        expiresAt: f.clock.now(),
      }),
      authorize: async (_request, permission) => {
        if (permission !== PERMISSION.populationView)
          throw new HTTPException(403);
        return f.createId();
      },
    });
    for (const path of ['/', '/users', '/workers']) {
      const response = await app.request(path);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).not.toContain(assignment.password);
      expect(text).not.toContain('credential');
      expect(text).not.toContain('inspection":');
    }
    expect(
      (await app.request(`/users/${assignment.lease.userId}`)).status
    ).toBe(403);
  } finally {
    await f.db.disconnect();
  }
});
