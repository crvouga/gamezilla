import { expect, test } from 'bun:test';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import {
  SignInInbox,
  syntheticPopulationSignInMail,
} from '@libs/synthetic-population-server-ts/sign-in-inbox';
import { createSyntheticPopulationRoutes } from '@libs/synthetic-population-server-ts/synthetic-population-routes';
import { createSyntheticPopulationWorkerRoutes } from '@libs/synthetic-population-server-ts/worker-routes';
import {
  isSyntheticAddress,
  SYNTHETIC_ADDRESS_DOMAIN,
} from '@libs/synthetic-population-shared-ts/synthetic-address';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { Hono } from 'hono';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

type Fixture = Awaited<ReturnType<typeof syntheticPopulationFixture>>;
type Ownership = { userId: string; workerId: string; generation: number };

const LINK_TTL_MS = 600_000;

function link(name: string): string {
  return `https://app.example.test/sso-callback?email_link=${name}`;
}

function ownershipOf(lease: Ownership): Ownership {
  return {
    userId: lease.userId,
    workerId: lease.workerId,
    generation: lease.generation,
  };
}

function workerRoutes(f: Fixture, authorize: () => Promise<void>) {
  return createSyntheticPopulationWorkerRoutes({
    getDb: () => f.db,
    ports: f.ports,
    authorize,
    bindAccount: async () => false,
  });
}

async function takeOver(
  app: ReturnType<typeof workerRoutes>,
  lease: Ownership
) {
  const response = await app.request('/take-sign-in-link', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ownershipOf(lease)),
  });
  return {
    status: response.status,
    cache: response.headers.get('cache-control'),
    body: (await response.json()) as { link?: string | null },
  };
}

async function storedMail(f: Fixture) {
  return f.db.query(
    sql<{
      email: string;
      link: string | null;
      deleted_at: string | null;
    }>`SELECT email, link, deleted_at FROM population_sign_in_mail ORDER BY created_at, id`
  );
}

test('only Synthetic User addresses are ever accepted for a sign-in link', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const mail = syntheticPopulationSignInMail({
      getDb: () => f.db,
      ports: f.ports,
    });
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    expect(assignment.email.endsWith(`@${SYNTHETIC_ADDRESS_DOMAIN}`)).toBe(
      true
    );
    expect(mail.accepts(assignment.email)).toBe(true);
    for (const address of [
      'alice@example.com',
      'alice@gmail.com',
      `alice@${SYNTHETIC_ADDRESS_DOMAIN}.example.com`,
      `alice@not${SYNTHETIC_ADDRESS_DOMAIN}`,
      `${SYNTHETIC_ADDRESS_DOMAIN}@example.com`,
      `@${SYNTHETIC_ADDRESS_DOMAIN}`,
      '',
    ]) {
      expect(mail.accepts(address)).toBe(false);
      expect(isSyntheticAddress(address)).toBe(false);
      // Even a host that ignored `accepts` could not make the inbox keep it.
      await mail.deliver({
        email: address,
        link: link('person'),
        expiresAt: f.clock.now() + LINK_TTL_MS,
      });
    }
    expect(await storedMail(f)).toHaveLength(0);
  } finally {
    await f.db.disconnect();
  }
});

test('mail for a Synthetic User no worker is running is dropped unread', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const inbox = new SignInInbox(f.db, f.ports);
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    await inbox.deliver({
      email: `${f.createId()}@${SYNTHETIC_ADDRESS_DOMAIN}`,
      link: link('unprovisioned'),
      expiresAt: f.clock.now() + LINK_TTL_MS,
    });
    expect(await f.leases.release(assignment.lease)).toBe(true);
    await inbox.deliver({
      email: assignment.email,
      link: link('released'),
      expiresAt: f.clock.now() + LINK_TTL_MS,
    });
    expect(await storedMail(f)).toHaveLength(0);
  } finally {
    await f.db.disconnect();
  }
});

test('the leased worker takes the newest link once and the row keeps no link', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const inbox = new SignInInbox(f.db, f.ports);
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    await inbox.deliver({
      email: assignment.email,
      link: link('older'),
      expiresAt: f.clock.now() + LINK_TTL_MS,
    });
    f.clock.advance(1_000);
    await inbox.deliver({
      email: assignment.email,
      link: link('newest'),
      expiresAt: f.clock.now() + LINK_TTL_MS,
    });
    // The superseded mail is already unreadable, before anything is taken.
    expect((await storedMail(f)).map((row) => row.link)).toEqual([
      null,
      link('newest'),
    ]);
    const app = workerRoutes(f, async () => undefined);
    const first = await takeOver(app, assignment.lease);
    expect(first).toEqual({
      status: 200,
      cache: 'no-store',
      body: { link: link('newest') },
    });
    expect(await takeOver(app, assignment.lease)).toMatchObject({
      status: 200,
      body: { link: null },
    });
    const rows = await storedMail(f);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.link).toBeNull();
      expect(row.deleted_at).not.toBeNull();
    }
    expect(JSON.stringify(rows)).not.toContain('email_link=');
  } finally {
    await f.db.disconnect();
  }
});

test('an expired link is never handed out', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    await new SignInInbox(f.db, f.ports).deliver({
      email: assignment.email,
      link: link('short-lived'),
      expiresAt: f.clock.now() + 1_000,
    });
    f.clock.advance(1_000);
    const taken = await takeOver(
      workerRoutes(f, async () => undefined),
      assignment.lease
    );
    expect(taken).toMatchObject({ status: 200, body: { link: null } });
    expect((await storedMail(f)).map((row) => row.link)).toEqual([null]);
  } finally {
    await f.db.disconnect();
  }
});

test('a worker reads only the inbox of the Synthetic User it holds the lease for', async () => {
  const f = await syntheticPopulationFixture(2);
  try {
    const inbox = new SignInInbox(f.db, f.ports);
    const cedar = (await f.controller.claim(f.workers[0]!))!;
    const birch = (await f.controller.claim(f.workers[1]!))!;
    expect(birch.lease.userId).not.toBe(cedar.lease.userId);
    await inbox.deliver({
      email: cedar.email,
      link: link('cedar'),
      expiresAt: f.clock.now() + LINK_TTL_MS,
    });
    const app = workerRoutes(f, async () => undefined);
    // Another worker naming Cedar, a stale generation, and its own lease.
    for (const lease of [
      { ...cedar.lease, workerId: birch.lease.workerId },
      { ...cedar.lease, generation: cedar.lease.generation + 1 },
    ])
      expect(await takeOver(app, lease)).toMatchObject({ status: 409 });
    expect(await takeOver(app, birch.lease)).toMatchObject({
      status: 200,
      body: { link: null },
    });
    expect((await storedMail(f)).map((row) => row.link)).toEqual([
      link('cedar'),
    ]);
    // A lease that ran out reads nothing, and the mail stays for the next owner.
    f.clock.advance(cedar.config.leaseMs);
    expect(await takeOver(app, cedar.lease)).toMatchObject({ status: 409 });
    expect((await storedMail(f)).map((row) => row.link)).toEqual([
      link('cedar'),
    ]);
  } finally {
    await f.db.disconnect();
  }
});

test('the inbox RPC rejects an unauthenticated caller before reading any mail', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    await new SignInInbox(f.db, f.ports).deliver({
      email: assignment.email,
      link: link('guarded'),
      expiresAt: f.clock.now() + LINK_TTL_MS,
    });
    const app = new Hono()
      .onError((error, c) =>
        c.json(
          { error: error.message },
          error instanceof UnauthorizedError ? 401 : 500
        )
      )
      .route(
        '/',
        createSyntheticPopulationWorkerRoutes({
          getDb: () => {
            throw new Error('Denied RPC reached the database');
          },
          ports: f.ports,
          bindAccount: async () => false,
          authorize: async () => {
            throw new UnauthorizedError(
              'Synthetic Population Worker authentication required'
            );
          },
        })
      );
    const response = await app.request('/take-sign-in-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ownershipOf(assignment.lease)),
    });
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('email_link=');
    expect((await storedMail(f)).map((row) => row.link)).toEqual([
      link('guarded'),
    ]);
  } finally {
    await f.db.disconnect();
  }
});

test('no administrative RPC reads the inbox, whatever the operator may do', async () => {
  const f = await syntheticPopulationFixture();
  try {
    const assignment = (await f.controller.claim(f.workers[0]!))!;
    await new SignInInbox(f.db, f.ports).deliver({
      email: assignment.email,
      link: link('operator-proof'),
      expiresAt: f.clock.now() + LINK_TTL_MS,
    });
    const admin = createSyntheticPopulationRoutes({
      getDb: () => f.db,
      ports: f.ports,
      subscriptionCredentials: async () => ({
        username: 'jwt',
        password: 'scoped',
        expiresAt: f.clock.now(),
      }),
      authorize: async () => f.createId(),
    });
    const base = `/users/${assignment.lease.userId}`;
    const requests = [
      { path: '/' },
      { path: '/users' },
      { path: '/workers' },
      { path: base },
      { path: `${base}/events` },
      { path: `${base}/replay`, method: 'POST' },
      { path: '/take-sign-in-link', method: 'POST' },
      { path: `${base}/sign-in-link` },
    ];
    for (const input of requests) {
      const response = await admin.request(input.path, {
        method: input.method ?? 'GET',
      });
      const text = await response.text();
      expect(text).not.toContain('email_link=');
      expect(text).not.toContain(assignment.email);
    }
    expect((await storedMail(f)).map((row) => row.link)).toEqual([
      link('operator-proof'),
    ]);
  } finally {
    await f.db.disconnect();
  }
});
