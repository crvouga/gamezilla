import { Hono } from 'hono';

import {
  handleDevAuthorize,
  handleDevAuthorizeComplete,
  handleGetSession,
  handleOauthCallback,
  handleOauthLaunch,
  handleSessionExchange,
  handleSignOut,
} from './auth-route-handlers';
import type {
  CreateAuthAppDeps,
  CreateAuthAppProviders,
} from './create-auth-app-types';

export type { CreateAuthAppDeps, CreateAuthAppProviders };

/**
 * Application-agnostic IdP Hono app. Runtime mounts with `.route('/', app)`.
 * All I/O is injected — safe for Workers, Node tests, and in-process sim.
 */
export function createAuthApp(deps: CreateAuthAppDeps): Hono {
  const app = new Hono();

  app.get('/auth/oauth/launch', (c) => handleOauthLaunch(c, deps));
  app.get('/auth/dev/authorize', (c) => handleDevAuthorize(c, deps));
  app.post('/auth/dev/authorize/complete', (c) =>
    handleDevAuthorizeComplete(c, deps)
  );
  app.get('/auth/callback/:provider', (c) => handleOauthCallback(c, deps));
  app.post('/auth/session', (c) => handleSessionExchange(c, deps));
  app.get('/auth/session', (c) => handleGetSession(c, deps));
  app.post('/auth/sign-out', (c) => handleSignOut(c, deps));

  return app;
}
