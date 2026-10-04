import { resolveSessionReplayAuth } from '@libs/app-shared/query-auth';
import { apiRequestAsyncLocalStorage } from '@libs/app-shared/request-scope';
import type { ComposedFeatureServers } from '@libs/feature-shared/compose-server';
import { mintPubSubToken } from '@libs/pubsub-server/mint-pubsub-token';
import { PubsubSecretName } from '@libs/pubsub-shared/secret-names';
import { assert } from '@pkgs/assert-shared/singleton';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { isAuthErrorBody } from '@pkgs/sync-engine-server/auth-error';
import { Hono } from 'hono';

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
