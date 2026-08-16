import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import { appAuth } from '@libs/auth/shared/auth-context';
import { BackfillFriendRequestInboxUseCase } from '@libs/friends/server/backfill-friend-request-inbox-use-case';
import { HandleFriendsInboxActionUseCase } from '@libs/friends/server/handle-friends-inbox-action-use-case';
import { assert } from '@pkgs/assert';
import { AsyncLocalStorage } from '@pkgs/async-local';
import { Inbox } from '@pkgs/inbox';
import { registerActionHandler } from '@pkgs/inbox/server/action-registry';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MiddlewareHandler } from 'hono';

import { apiRequestAsyncLocalStorage } from '../request-scope';
import { notifyUserChannels } from '../sync/notify-user-channels';

type InboxActor = {
  readonly accountId: string;
  readonly deviceId: string;
};

const inboxActorStorage = new AsyncLocalStorage<InboxActor>();

let handlersRegistered = false;

function ensureInboxHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  registerActionHandler('friends', async (ctx) => {
    const payload = ctx.interaction.payload;
    const requestId =
      typeof payload['requestId'] === 'string' ? payload['requestId'] : null;
    if (requestId === null) {
      throw new Error('Missing requestId in interaction payload');
    }
    const actor = inboxActorStorage.getStore();
    assert.defined(actor, 'friends inbox: actor missing');
    const store = apiRequestAsyncLocalStorage.getStore();
    assert.defined(store, 'friends inbox: request store missing');
    const result = await new HandleFriendsInboxActionUseCase(
      store.sqlClient,
      store.io
    ).execute({
      actorId: ctx.actorId,
      deviceId: actor.deviceId,
      actionId: ctx.actionId,
      requestId,
    });
    await notifyUserChannels(result.userIds, `friends-inbox:${ctx.actionId}`);
  });
}

const requireAuth: MiddlewareHandler = async (c, next) => {
  const store = apiRequestAsyncLocalStorage.getStore();
  assert.defined(store, 'inbox auth: request store missing');
  try {
    const ctx = await store.sessionAuth.requireAuthContext(
      store.sqlClient,
      c.req.raw
    );
    const auth = appAuth(ctx);
    if (auth === null || auth.accountId === null) {
      throw new UnauthorizedError('Inbox requires a signed-in account');
    }
    return inboxActorStorage.run(
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
      assert.defined(store, 'inbox sql: request store missing');
      return store.sqlClient.query(query);
    },
    run: (query) => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'inbox sql: request store missing');
      return store.sqlClient.run(query);
    },
    transaction: (fn) => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'inbox sql: request store missing');
      return store.sqlClient.transaction(fn);
    },
    prepare: (query) => {
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'inbox sql: request store missing');
      return store.sqlClient.prepare(query);
    },
  };
}

function lazyRequestContext() {
  const store = apiRequestAsyncLocalStorage.getStore();
  const actor = inboxActorStorage.getStore();
  assert.defined(store, 'inbox: request store missing');
  assert.defined(actor, 'inbox: actor id missing');
  return { sql: store.sqlClient, actorId: actor.accountId };
}

let inboxInstance: Inbox | null = null;

function getInbox(): Inbox {
  if (inboxInstance === null) {
    inboxInstance = new Inbox({ sqlClient: lazyRequestSqlClient() });
  }
  return inboxInstance;
}

export function createInboxSubApp() {
  ensureInboxHandlers();
  const inbox = getInbox();
  const app = inbox.app({ requireAuth, requestContext: lazyRequestContext });

  app.use('*', async (_c, next) => {
    await inbox.ready();
    await next();
  });

  app.post('/backfill', async (c) => {
    const store = apiRequestAsyncLocalStorage.getStore();
    assert.defined(store, 'inbox backfill: request store missing');
    const { actorId } = lazyRequestContext();
    const count = await new BackfillFriendRequestInboxUseCase(
      store.sqlClient,
      store.io
    ).execute(actorId);
    return c.json({ backfilled: count });
  });

  return app;
}
