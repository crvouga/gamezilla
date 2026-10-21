import { expect, test } from 'bun:test';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { SignInInbox } from '@libs/synthetic-population-server-ts/sign-in-inbox';
import { createSyntheticPopulationRoutes } from '@libs/synthetic-population-server-ts/synthetic-population-routes';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

const SIGN_IN_LINK = 'https://app.example.test/sso-callback?email_link=one';

function mailFor(
  f: Awaited<ReturnType<typeof syntheticPopulationFixture>>,
  email: string
) {
  return { email, link: SIGN_IN_LINK, expiresAt: f.clock.now() + 600_000 };
}

test('each administrative RPC rejects denied actors before reading or changing population data', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    await new SignInInbox(f.db, f.ports).deliver(mailFor(f, assignment.email));
    const base = `/users/${assignment.lease.userId}`;
    const checked: string[] = [];
    const app = new Hono().route(
      '/',
      createSyntheticPopulationRoutes({
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
      { path: '/', permission: PERMISSION.syntheticPopulationView },
      { path: '/users', permission: PERMISSION.syntheticPopulationView },
      { path: '/workers', permission: PERMISSION.syntheticPopulationView },
      { path: '/subscription', permission: PERMISSION.syntheticPopulationView },
      { path: base, permission: PERMISSION.syntheticPopulationInspect },
      {
        path: `${base}/events`,
        permission: PERMISSION.syntheticPopulationInspect,
      },
      {
        path: `${base}/replay`,
        method: 'POST',
        permission: PERMISSION.syntheticPopulationReplay,
      },
      {
        path: '/config',
        method: 'PUT',
        body: await f.repo.config(),
        permission: PERMISSION.syntheticPopulationConfigure,
      },
      ...(['pause', 'resume', 'restart', 'inspect'] as const).map(
        (command) => ({
          path: `${base}/commands`,
          method: 'POST',
          body: { operationId: f.createId(), command },
          permission:
            command === 'inspect'
              ? PERMISSION.syntheticPopulationInspect
              : PERMISSION.syntheticPopulationControl,
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
      expect(await response.text()).not.toContain(SIGN_IN_LINK);
    }
    expect(checked).toHaveLength(requests.length);
  } finally {
    await f.db.disconnect();
  }
});

test('view RPC never exposes sign-in mail or an inspect-only DOM snapshot', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    await new SignInInbox(f.db, f.ports).deliver(mailFor(f, assignment.email));
    const app = createSyntheticPopulationRoutes({
      getDb: () => f.db,
      ports: f.ports,
      subscriptionCredentials: async () => ({
        username: 'jwt',
        password: 'scoped',
        expiresAt: f.clock.now(),
      }),
      authorize: async (_request, permission) => {
        if (permission !== PERMISSION.syntheticPopulationView)
          throw new HTTPException(403);
        return f.createId();
      },
    });
    for (const path of ['/', '/users', '/workers']) {
      const response = await app.request(path);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).not.toContain(SIGN_IN_LINK);
      expect(text).not.toContain(assignment.email);
      expect(text).not.toContain('inspection":');
    }
    expect(
      (await app.request(`/users/${assignment.lease.userId}`)).status
    ).toBe(403);
  } finally {
    await f.db.disconnect();
  }
});
