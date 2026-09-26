import { Hono } from 'hono';
import { SYNTHETIC_MONITOR_CODE_PATH } from '../shared/synthetic-monitor';
import { handleAppleNotification } from './apple-notification-handler';
import {
  handleGetSession,
  handleSessionExchange,
  handleSignOut,
  handleSignOutAll,
} from './auth-route-handlers';
import type {
  AuthAppCtx,
  CreateAuthAppDeps,
  CreateAuthAppProviders,
} from './create-auth-app-types';
import {
  handleCreateSeparate,
  handleLinkTicket,
  handleListIdentities,
  handleUnlink,
} from './identity-handlers';
import { handleOauthCallback, handleOauthLaunch } from './oauth-handlers';
import { createOauthProviders } from './providers/registry';
import { handleSyntheticMonitorCode } from './synthetic-monitor';

export type { CreateAuthAppDeps, CreateAuthAppProviders };

/**
 * Application-agnostic IdP Hono app. Runtime mounts with `.route('/', app)`.
 * All I/O is injected — safe for Workers, Node tests, and in-process sim.
 */
export function createAuthApp(deps: CreateAuthAppDeps): Hono {
  const ctx: AuthAppCtx = {
    deps,
    oauth: createOauthProviders({
      config: deps.providers,
      http: deps.http,
      clock: deps.clock,
    }),
  };
  const app = new Hono();

  app.get('/auth/providers', (c) => c.json({ providers: ctx.oauth.enabled }));
  app.get('/auth/oauth/launch', (c) => handleOauthLaunch(c, ctx));
  // Google returns with a redirect; Apple POSTs a form (`form_post`).
  app.get('/auth/callback/:provider', (c) => handleOauthCallback(c, ctx));
  app.post('/auth/callback/:provider', (c) => handleOauthCallback(c, ctx));
  app.post('/auth/session', (c) => handleSessionExchange(c, ctx));
  app.get('/auth/session', (c) => handleGetSession(c, ctx));
  app.post('/auth/sign-out', (c) => handleSignOut(c, ctx));
  app.post('/auth/sign-out-all', (c) => handleSignOutAll(c, ctx));
  app.get('/auth/identities', (c) => handleListIdentities(c, ctx));
  app.post('/auth/identities/unlink', (c) => handleUnlink(c, ctx));
  app.post('/auth/link/ticket', (c) => handleLinkTicket(c, ctx));
  app.post('/auth/link/separate', (c) => handleCreateSeparate(c, ctx));
  app.post('/auth/apple/notifications', (c) => handleAppleNotification(c, ctx));
  app.post(SYNTHETIC_MONITOR_CODE_PATH, (c) =>
    handleSyntheticMonitorCode(c, ctx)
  );

  return app;
}
