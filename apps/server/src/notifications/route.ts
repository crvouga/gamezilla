import { appAuth } from '@libs/auth/public/auth-context';
import { UnauthorizedError } from '@libs/auth/public/unauthorized-error';
import { HandleFriendsNotificationsActionUseCase } from '@libs/friends/root/server/handle-friends-notifications-action-use-case';
import { registerNotificationActionHandler } from '@libs/notifications/public/notifications';
import { NotificationsApp } from '@libs/notifications/root/server/notifications-app';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { requirePermission } from '@libs/permissions/root/server/require-permission';
import { assert } from '@pkgs/assert';
import { AsyncLocalStorage } from '@pkgs/async-local';
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
      { clock: store.clock, createId: store.createId }
    ).execute({
      actorId: ctx.actorId,
      deviceId: actor.deviceId,
      actionId: ctx.actionId,
      requestId,
    });
    const { drainAndNotifyOutbox } = await import('../sync/outbox-drain');
    await drainAndNotifyOutbox({
      db: store.sqlClient,
      clock: store.clock,
      createId: store.createId,
    });
    // OOB domain writes bypass mutation-replay fanout. Publish synchronously
    // (same as outbox-drain) so DST sim timers need not advance for peers to
    // refetch friendships / requests. Omit `tables` so every active scope wakes.
    await notifyUserChannels(
      result.userIds,
      `friends-notifications:${ctx.actionId}`,
      {
        deferPublish: false,
      }
    );
  });
}

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
  return { sql: store.sqlClient, actorId: actor.accountId };
}

let notificationsApp: NotificationsApp | null = null;

function getNotificationsApp(): NotificationsApp {
  if (notificationsApp === null) {
    notificationsApp = new NotificationsApp();
  }
  return notificationsApp;
}

export function createNotificationsSubApp(now: () => number) {
  ensureNotificationsHandlers();
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
