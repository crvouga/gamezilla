/**
 * Test-only control plane (`/__idp/*`). Real providers have no such thing;
 * this is how a suite seeds the directory, forces a fault, plays the account
 * holder (revoking an app, deleting the account, toggling relay forwarding),
 * or wipes browser state between scenarios without reaching into the
 * provider's storage directly.
 */

import { type Context, Hono } from 'hono';

import {
  IDP_APPLE_EVENT_TYPES,
  type IdpAppleEventType,
  type IdpClient,
  type IdpFaults,
} from '../../shared/types';
import { type IdpCtx, issuerOf } from '../idp-context';
import { normalizeFaults } from '../store/state';
import { parseAdminAccountDraft } from './account-creation';
import { deleteAppleAccount, emitAppleEvent } from './apple-events';

function readFaults(raw: unknown, current: IdpFaults): IdpFaults {
  if (raw === null || typeof raw !== 'object') return current;
  return normalizeFaults({ ...current, ...(raw as Partial<IdpFaults>) });
}

type Body = Record<string, unknown>;

async function jsonBody(c: Context): Promise<Body> {
  const raw: unknown = await c.req.json().catch(() => null);
  return raw !== null && typeof raw === 'object' ? (raw as Body) : {};
}

function text(body: Body, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value : '';
}

function eventType(raw: string): IdpAppleEventType | null {
  return IDP_APPLE_EVENT_TYPES.find((type) => type === raw) ?? null;
}

async function stateOf(ctx: IdpCtx) {
  const [accounts, clients, faults, stats] = await Promise.all([
    ctx.store.accounts(),
    ctx.store.clients(),
    ctx.store.faults(),
    ctx.store.stats(),
  ]);
  return {
    provider: ctx.store.provider,
    accounts,
    clients: clients.map((client) => client.clientId),
    sessions: stats.sessions,
    grants: stats.grants,
    pendingAuthRequests: stats.pendingAuthRequests,
    liveAccessTokens: stats.liveAccessTokens,
    faults,
    signingKids: ctx.store.publishedJwks().map((jwk) => jwk.kid),
  };
}

/** The holder removes the app's access ("Stop using Apple Account"). */
async function revokeGrant(c: Context, ctx: IdpCtx): Promise<Response> {
  const body = await jsonBody(c);
  const sub = text(body, 'sub');
  const clientId = text(body, 'clientId');
  if (ctx.store.provider === 'apple') {
    return c.json(
      await emitAppleEvent(ctx, {
        type: 'consent-revoked',
        sub,
        clientId,
        issuer: issuerOf(ctx, c),
      })
    );
  }
  await ctx.store.tx((store) => store.revokeGrant(sub, clientId));
  return c.json({ ok: true });
}

async function appleEvent(c: Context, ctx: IdpCtx): Promise<Response> {
  if (ctx.store.provider !== 'apple') {
    return c.json({ error: 'server-to-server events are Apple-only' }, 400);
  }
  const body = await jsonBody(c);
  const type = eventType(text(body, 'type'));
  if (type === null) return c.json({ error: 'unknown event type' }, 400);
  const result = await emitAppleEvent(ctx, {
    type,
    sub: text(body, 'sub'),
    clientId: text(body, 'clientId'),
    issuer: issuerOf(ctx, c),
  });
  return c.json(result, 'error' in result ? 400 : 200);
}

async function deleteAccount(c: Context, ctx: IdpCtx): Promise<Response> {
  const sub = c.req.param('sub') ?? '';
  if (ctx.store.provider === 'apple') {
    return c.json({
      ok: true,
      deliveries: await deleteAppleAccount(ctx, sub, issuerOf(ctx, c)),
    });
  }
  await ctx.store.tx((store) => store.deleteAccount(sub));
  return c.json({ ok: true });
}

export function createIdpAdminApp(ctx: IdpCtx): Hono {
  const app = new Hono();

  app.get('/state', async (c) => c.json(await stateOf(ctx)));

  app.post('/reset', async (c) => {
    await ctx.store.tx(async (store) => {
      await store.resetRuntimeState();
      await store.resetFaults();
    });
    return c.json({ ok: true });
  });

  app.post('/accounts', async (c) => {
    const parsed = parseAdminAccountDraft(await c.req.json());
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    return c.json(await ctx.store.upsertAccount(parsed.draft), 201);
  });

  app.delete('/accounts/:sub', (c) => deleteAccount(c, ctx));

  app.post('/clients', async (c) => {
    const client = (await c.req.json()) as IdpClient;
    return c.json(await ctx.store.registerClient(client), 201);
  });

  app.post('/faults', async (c) => {
    const next = readFaults(await c.req.json(), await ctx.store.faults());
    await ctx.store.setFaults(next);
    return c.json(next);
  });

  app.post('/grants/revoke', (c) => revokeGrant(c, ctx));
  app.post('/events', (c) => appleEvent(c, ctx));

  app.post('/keys/rotate', async (c) => {
    const keys = await ctx.store.rotateSigningKeys();
    return c.json({ kid: keys.kid });
  });

  app.post('/sign-out', async (c) => {
    await ctx.store.clearSessions();
    return c.json({ ok: true });
  });

  return app;
}
