import type { ComposedFeatureServers } from '@libs/feature/public/compose-server';
import { PubsubSecretName } from '@libs/pubsub/public/secret-names';
import { mintPubSubToken } from '@libs/pubsub/root/server/mint-pubsub-token';
import { assert } from '@pkgs/assert';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { isAuthErrorBody } from '@pkgs/sync-engine/server';
import { Hono } from 'hono';
import { apiRequestAsyncLocalStorage } from '../request-scope';
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
export function createPubSubTokenRoutes(servers: ComposedFeatureServers) {
  return new Hono().post('/pubsub/token', async (c) => {
    const auth = await resolveSessionReplayAuth(c.req.raw);
    if (isAuthErrorBody(auth)) {
      return c.json(auth, 401);
    }
    const store = apiRequestAsyncLocalStorage.getStore();
    assert.defined(store, 'pubsub token: request store missing');
    const secret = (
      await store.secretStore.getOptional(PubsubSecretName.jwtSecret)
    )?.readSecretValue();
    if (typeof secret !== 'string' || secret.trim().length === 0) {
      return c.json({ error: 'pubsub_unavailable' }, 503);
    }
    const featureTopics = await servers.pubsubTopics({
      actorId: auth.actorId,
      db: openRequestSqlClient(),
    });
    const { token, expiresAt } = await mintPubSubToken({
      secret: secret.trim(),
      actorId: auth.actorId,
      featureTopics,
      now: store.clock.now,
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
