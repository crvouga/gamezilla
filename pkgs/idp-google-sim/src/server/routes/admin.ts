/**
 * Test-only control plane (`/__idp/*`). Real Google has no such thing; this is
 * how a suite seeds the directory, forces a fault, or wipes browser state
 * between scenarios without reaching into the provider's memory directly.
 */

import { Hono } from 'hono';

import { IDP_DEFAULT_FAULTS, type IdpFaults } from '../../shared/types';
import type { IdpCtx } from '../idp-context';
import {
  type IdpAccountDraft,
  registerClient,
  resetRuntimeState,
  upsertAccount,
} from '../idp-seed';

function readFaults(raw: unknown, current: IdpFaults): IdpFaults {
  if (raw === null || typeof raw !== 'object') return current;
  const patch = raw as Partial<IdpFaults>;
  return {
    tokenEndpoint: patch.tokenEndpoint ?? current.tokenEndpoint,
    userinfoEndpoint: patch.userinfoEndpoint ?? current.userinfoEndpoint,
    denyConsent: patch.denyConsent ?? current.denyConsent,
    withholdRefreshToken:
      patch.withholdRefreshToken ?? current.withholdRefreshToken,
  };
}

export function createIdpAdminApp(ctx: IdpCtx): Hono {
  const app = new Hono();

  app.get('/state', (c) =>
    c.json({
      accounts: [...ctx.state.accounts.values()].map((account) => ({
        ...account,
        password: undefined,
      })),
      clients: [...ctx.state.clients.values()].map((client) => client.clientId),
      sessions: [...ctx.state.sessions.values()],
      grants: [...ctx.state.grants].map(([key, scopes]) => ({ key, scopes })),
      pendingAuthRequests: ctx.state.authRequests.size,
      liveAccessTokens: ctx.state.accessTokens.size,
      faults: ctx.state.faults,
    })
  );

  app.post('/reset', (c) => {
    resetRuntimeState(ctx.state);
    ctx.state.faults = IDP_DEFAULT_FAULTS;
    return c.json({ ok: true });
  });

  app.post('/accounts', async (c) => {
    const draft = (await c.req.json()) as IdpAccountDraft;
    return c.json(upsertAccount(ctx.state, draft), 201);
  });

  app.delete('/accounts/:sub', (c) => {
    ctx.state.accounts.delete(c.req.param('sub'));
    return c.json({ ok: true });
  });

  app.post('/clients', async (c) => {
    const client = await c.req.json();
    return c.json(registerClient(ctx.state, client), 201);
  });

  app.post('/faults', async (c) => {
    ctx.state.faults = readFaults(await c.req.json(), ctx.state.faults);
    return c.json(ctx.state.faults);
  });

  app.post('/sign-out', (c) => {
    ctx.state.sessions.clear();
    return c.json({ ok: true });
  });

  return app;
}
