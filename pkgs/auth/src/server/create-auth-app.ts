import { Hono } from 'hono';

import {
  googleRedirectUri,
  handleDevComplete,
  handleGetSession,
  handleOauthCallback,
  handleOauthStart,
  handleSessionExchange,
  handleSignOut,
} from './auth-route-handlers';
import type {
  CreateAuthAppDeps,
  CreateAuthAppProviders,
} from './create-auth-app-types';

export type { CreateAuthAppDeps, CreateAuthAppProviders };

/**
 * Application-agnostic IdP Hono app. Host mounts with `.route('/', app)`.
 * All I/O is injected — safe for Workers, Node tests, and in-process sim.
 */
export function createAuthApp(deps: CreateAuthAppDeps): Hono {
  const app = new Hono();
  const publicPathPrefix = deps.publicPathPrefix ?? '';
  const googleCallbackUri = googleRedirectUri(deps.baseURL, publicPathPrefix);

  app.post('/auth/oauth/start', (c) =>
    handleOauthStart(c, deps, googleCallbackUri)
  );
  app.get('/auth/callback/:provider', (c) =>
    handleOauthCallback(c, deps, googleCallbackUri)
  );
  app.post('/auth/session', (c) => handleSessionExchange(c, deps));
  app.get('/auth/session', (c) => handleGetSession(c, deps));
  app.post('/auth/sign-out', (c) => handleSignOut(c, deps));
  app.post('/auth/oauth/dev/complete', (c) => handleDevComplete(c, deps));

  return app;
}
