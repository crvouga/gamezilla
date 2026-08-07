import { loadMySpaceIdsFromSql } from '@libs/spaces/server/load-my-space-ids-sql';
import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { isAuthErrorBody } from '@pkgs/sync-engine/server';
import { Hono } from 'hono';

import { ApiSecretName } from '../config/secret-names';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { mintPubSubToken } from './mint-pubsub-token';
import { resolveSessionReplayAuth } from './query-auth';

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'pubsub token sql: request store missing');
  return requestStore.sqlClient;
}

/**
 * `POST /api/pubsub/token` — session-authed short-lived MQTT JWT
 * (username `jwt`, password = token). ACL allows subscribe + publish on the
 * actor's user/room/system topics (mutation fanout + push subscribe).
 */
export function createPubSubTokenRoutes() {
  return new Hono().post('/pubsub/token', async (c) => {
    const auth = await resolveSessionReplayAuth(c.req.raw);
    if (isAuthErrorBody(auth)) {
      return c.json(auth, 401);
    }
    const store = apiRequestAsyncLocalStorage.getStore();
    assert.defined(store, 'pubsub token: request store missing');
    const secret = (
      await store.secretStore.getOptional(ApiSecretName.emqxJwtSecret)
    )?.readSecretValue();
    if (typeof secret !== 'string' || secret.trim().length === 0) {
      return c.json({ error: 'pubsub_unavailable' }, 503);
    }
    const spaceIds = await loadMySpaceIdsFromSql(
      openRequestSqlClient(),
      auth.actorId
    );
    const { token, expiresAt } = await mintPubSubToken({
      secret: secret.trim(),
      actorId: auth.actorId,
      spaceIds,
    });
    return c.json(
      {
        username: 'jwt',
        password: token,
        expiresAt,
      },
      200
    );
  });
}
