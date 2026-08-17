import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import { appAuth } from '@libs/auth/shared/auth-context';
import { HandleFriendsNotificationsActionUseCase } from '@libs/friends/server/handle-friends-notifications-action-use-case';
import {
  NotificationsApp,
  registerNotificationActionHandler,
} from '@libs/notifications';
import { assert } from '@pkgs/assert';
import { AsyncLocalStorage } from '@pkgs/async-local';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MiddlewareHandler } from 'hono';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { notifyUserChannels } from '../sync/notify-user-channels';

type NotificationsActor = {
  readonly accountId: string;
  readonly deviceId: string;
};

const notificationsActorStorage = new AsyncLocalStorage<NotificationsActor>();

let handlersRegistered = false;

function ensureNotificationsHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  registerNotificationActionHandler('friends', async (ctx) => {
    const payload = ctx.interaction.payload;
    const requestId =
      typeof payload['requestId'] === 'string' ? payload['requestId'] : null;
    if (requestId === null) {
      throw new Error('Missing requestId in notification payload');
    }
    const actor = notificationsActorStorage.getStore();
    assert.defined(actor, 'friends notifications: actor missing');
    const store = apiRequestAsyncLocalStorage.getStore();
    assert.defined(store, 'friends notifications: request store missing');
    const result = await new HandleFriendsNotificationsActionUseCase(
      store.sqlClient,
      store.io
    ).execute({
      actorId: ctx.actorId,
      deviceId: actor.deviceId,
      actionId: ctx.actionId,
      requestId,
    });
    const { drainAndNotifyOutbox } = await import('../sync/outbox-drain');
    await drainAndNotifyOutbox({ db: store.sqlClient, io: store.io });
    await notifyUserChannels(
      result.userIds,
      `friends-notifications:${ctx.actionId}`,
      ['notifications']
    );
  });
}

const requireAuth: MiddlewareHandler = async (c, next) => {
  const store = apiRequestAsyncLocalStorage.getStore();
  assert.defined(store, 'notifications auth: request store missing');
  try {
    const ctx = await store.sessionAuth.requireAuthContext(
      store.sqlClient,
      c.req.raw
    );
    const auth = appAuth(ctx);
    if (auth === null || auth.accountId === null) {
      throw new UnauthorizedError('Notifications requires a signed-in account');
    }
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

function lazyRequestSqlClient(): SqlClient {
  return {
    connect: async () => {},
    disconnect: async () => {},
    query: (query) => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'notifications sql: request store missing');
      return store.sqlClient.query(query);
    },
    run: (query) => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'notifications sql: request store missing');
      return store.sqlClient.run(query);
    },
    transaction: (fn) => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'notifications sql: request store missing');
      return store.sqlClient.transaction(fn);
    },
    prepare: (query) => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'notifications sql: request store missing');
      return store.sqlClient.prepare(query);
    },
  };
}

function lazyRequestContext() {
  const store = apiRequestAsyncLocalStorage.getStore();
  const actor = notificationsActorStorage.getStore();
  assert.defined(store, 'notifications: request store missing');
  assert.defined(actor, 'notifications: actor id missing');
  return { sql: store.sqlClient, actorId: actor.accountId };
}

let notificationsApp: NotificationsApp | null = null;

function getNotificationsApp(): NotificationsApp {
  if (notificationsApp === null) {
    notificationsApp = new NotificationsApp({
      sqlClient: lazyRequestSqlClient(),
    });
  }
  return notificationsApp;
}

export function createNotificationsSubApp() {
  ensureNotificationsHandlers();
  const shell = getNotificationsApp();
  const app = shell.app({ requireAuth, requestContext: lazyRequestContext });

  app.use('*', async (_c, next) => {
    await shell.ready();
    await next();
  });

  return app;
}
