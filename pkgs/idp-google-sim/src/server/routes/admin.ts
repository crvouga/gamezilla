/**
 * Test-only control plane (`/__idp/*`). Real Google has no such thing; this is
 * how a suite seeds the directory, forces a fault, or wipes browser state
 * between scenarios without reaching into the provider's storage directly.
 */

import { Hono } from 'hono';

import type { IdpClient, IdpFaults } from '../../shared/types';
import type { IdpCtx } from '../idp-context';
import { normalizeFaults } from '../store/state';
import { parseAdminAccountDraft } from './account-creation';

function readFaults(raw: unknown, current: IdpFaults): IdpFaults {
  if (raw === null || typeof raw !== 'object') return current;
  return normalizeFaults({ ...current, ...(raw as Partial<IdpFaults>) });
}

export function createIdpAdminApp(ctx: IdpCtx): Hono {
  const app = new Hono();

  app.get('/state', async (c) => {
    const [accounts, clients, faults, stats] = await Promise.all([
      ctx.store.accounts(),
      ctx.store.clients(),
      ctx.store.faults(),
      ctx.store.stats(),
    ]);
    return c.json({
      accounts,
      clients: clients.map((client) => client.clientId),
      sessions: stats.sessions,
      grants: stats.grants,
      pendingAuthRequests: stats.pendingAuthRequests,
      liveAccessTokens: stats.liveAccessTokens,
      faults,
    });
  });

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

  app.delete('/accounts/:sub', async (c) => {
    await ctx.store.deleteAccount(c.req.param('sub'));
    return c.json({ ok: true });
  });

  app.post('/clients', async (c) => {
    const client = (await c.req.json()) as IdpClient;
    return c.json(await ctx.store.registerClient(client), 201);
  });

  app.post('/faults', async (c) => {
    const next = readFaults(await c.req.json(), await ctx.store.faults());
    await ctx.store.setFaults(next);
    return c.json(next);
  });

  app.post('/sign-out', async (c) => {
    await ctx.store.clearSessions();
    return c.json({ ok: true });
  });

  return app;
}
