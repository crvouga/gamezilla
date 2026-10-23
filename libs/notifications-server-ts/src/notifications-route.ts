import { notifyUserChannels } from '@libs/app-root-server-ts/notify-user-channels';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared-ts/request-scope';
import { appAuth } from '@libs/auth-shared-ts/auth-context';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { requirePermission } from '@libs/permissions-shared-ts/require-permission';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { AsyncLocalStorage } from '@pkgs/async-local-shared-ts/async-local-storage';
import type { MiddlewareHandler } from 'hono';
import { NotificationsApp } from './notifications-app';

export type NotificationsActor = {
  readonly accountId: string;
  readonly deviceId: string;
};

/**
 * The signed-in actor for the current inbox request. Published so a sub
 * that answers an inbox action can read who is answering without the inbox
 * knowing what the action means.
 */
export const notificationsActorStorage =
  new AsyncLocalStorage<NotificationsActor>();

const requireAuth: MiddlewareHandler = async (c, next) => {
  const store = apiRequestAsyncLocalStorage.getStore();
  assert.defined(store, 'notifications auth: request store missing');
  try {
    const ctx = await store.sessionAuth.resolveAuthContext(
      store.sqlClient,
      c.req.raw
    );
    const auth = appAuth(ctx);
    await requirePermission({
      db: store.sqlClient,
      auth,
      permission: PERMISSION.notificationsReceive,
      nowMs: store.clock.now(),
    });
    assert.defined(auth, 'notifications: auth missing');
    assert.defined(auth.accountId, 'notifications: account missing');
    return notificationsActorStorage.run(
      { accountId: auth.accountId, deviceId: auth.deviceId },
      next
    );
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return c.json({ error: err.message }, 401);
    }
    throw err;
  }
};

function lazyRequestContext() {
  const store = apiRequestAsyncLocalStorage.getStore();
  const actor = notificationsActorStorage.getStore();
  assert.defined(store, 'notifications: request store missing');
  assert.defined(actor, 'notifications: actor id missing');
  return {
    sql: store.sqlClient,
    actorId: actor.accountId,
    inboxChanged: () =>
      notifyUserChannels([actor.accountId], 'notifications-inbox', {
        tables: ['notifications'],
      }),
  };
}

let notificationsApp: NotificationsApp | null = null;

function getNotificationsApp(): NotificationsApp {
  if (notificationsApp === null) {
    notificationsApp = new NotificationsApp();
  }
  return notificationsApp;
}

export function createNotificationsSubApp(now: () => number) {
  const shell = getNotificationsApp();
  const app = shell.app({
    requireAuth,
    requestContext: lazyRequestContext,
    now,
  });

  app.use('*', async (_c, next) => {
    await shell.ready();
    await next();
  });

  return app;
}
