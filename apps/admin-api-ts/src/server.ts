import { notifyUserChannels } from '@libs/app-root-server-ts/notify-user-channels';
import { setOutboxConsumerRegistry } from '@libs/app-root-server-ts/outbox-drain';
import { createPubSubTokenRoutes } from '@libs/app-root-server-ts/pubsub-token-routes';
import {
  createRequestDbMiddleware,
  type RequestDbMiddlewareOptions,
} from '@libs/app-root-server-ts/request-db-middleware';
import { createSyncApp } from '@libs/app-root-server-ts/sync-app';
import { requireRequestStore } from '@libs/app-root-shared-ts/request-scope';
import { AuthApiRoutes } from '@libs/auth-server-ts/auth-routes';
import type { ApiHonoEnv } from '@libs/auth-shared-ts/api-hono-env';
import { appAuth } from '@libs/auth-shared-ts/auth-context';
import type { AuthContext } from '@libs/auth-shared-ts/types';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { permissionPolicyForAdmins } from '@libs/permissions-shared-ts/permission-policy';
import { requireAdminAccess } from '@libs/permissions-shared-ts/require-permission';
import { ADMIN_APP } from '@libs/runtime-shared-ts/admin-subs';
import { authorizeSyntheticPopulationSession } from '@libs/synthetic-population-server-ts/session-fencing';
import { ForbiddenError } from '@pkgs/assert-root-shared-ts/forbidden-error';
import type { AuthProvider } from '@pkgs/auth-root-shared-ts/auth-provider-module';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';
import { isUuid } from '@pkgs/uuid-shared-ts/uuid';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { adminServers } from './admin-servers';

function mountAdminSignIn(
  api: Hono<ApiHonoEnv<AuthContext>>,
  auth: AuthProvider
) {
  // These routes establish a session. Every dashboard read and write follows the gate.
  const handler = auth.handler;
  if (handler) {
    for (const path of [
      '/providers',
      '/oauth/launch',
      '/callback/:provider',
      '/session',
      '/sign-out',
      '/link/ticket',
      '/link/separate',
    ]) {
      api.all(`${handler.pathPrefix}${path}`, (c) => handler.fetch(c.req.raw));
    }
  }
  api.use('*', async (c, next) => {
    if (
      c.req.method === 'POST' &&
      (c.req.path === '/api/identity/anon/ensure' ||
        c.req.path === '/api/identity/refresh')
    )
      return next();
    if (
      !isUuid(c.req.header('x-anon-id')) ||
      !/^Bearer \S+$/.test(c.req.header('authorization') ?? '')
    )
      throw new UnauthorizedError('Sign in to open administration.');
    const store = requireRequestStore();
    const context = await store.sessionAuth.resolveAuthContext(
      store.sqlClient,
      c.req.raw
    );
    await requireAdminAccess({
      db: store.sqlClient,
      auth: appAuth(context),
      nowMs: store.clock.now(),
    });
    await next();
  });
}

export async function createAdminApi(
  auth: AuthProvider,
  secrets: SecretStore,
  ports: Omit<
    RequestDbMiddlewareOptions,
    'authServer' | 'desiredClientConfig'
  > & { readonly adminAccountIds: readonly string[] }
) {
  const { clock, createId } = ports;
  const log = createLogger({ name: 'admin-api', now: clock.now });
  setOutboxConsumerRegistry(adminServers.outboxConsumers, ADMIN_APP.topicMap);
  const sync = await createSyncApp({
    app: ADMIN_APP,
    outboxConsumers: adminServers.outboxConsumers,
    authorizeServerMutation: adminServers.authorizeMutation,
    now: clock.now,
    createId,
    moderation: shippedModerationRules(),
  });
  const api = new Hono<ApiHonoEnv<AuthContext>>().basePath('/api');
  api.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });
  api.get('/health', (c) => c.json({ status: 'ok' }));
  api.use(
    '*',
    createRequestDbMiddleware(secrets, {
      ...ports,
      authServer: auth.server,
      desiredClientConfig: {
        kind: 'admin',
        permissionPolicy: permissionPolicyForAdmins(ports.adminAccountIds),
      },
      authorizeSession: authorizeSyntheticPopulationSession,
    })
  );

  mountAdminSignIn(api, auth);
  const identity = new AuthApiRoutes(clock, createId, (ids) =>
    notifyUserChannels(ids, 'auth-domain-write')
  ).build();
  api.get('/admin/access', (c) => c.body(null, 204));
  api
    .route('/', identity)
    .route('/', sync)
    .route('/', createPubSubTokenRoutes(adminServers));
  for (const router of adminServers.routers({
    clock,
    createId,
    authServer: auth.server,
    getSqlClient: () => requireRequestStore().sqlClient,
  }))
    api.route('/', router);
  api.onError((err, c) => {
    if (err instanceof ForbiddenError)
      return c.json({ error: err.message }, 403);
    if (err instanceof UnauthorizedError)
      return c.json({ error: err.message }, 401);
    if (err instanceof HTTPException)
      return c.json({ error: err.message }, err.status);
    log.error('admin request failed', { error: err });
    return c.json({ error: 'Administration is unavailable. Try again.' }, 500);
  });
  return api;
}
