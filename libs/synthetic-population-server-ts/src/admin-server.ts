import { requireRequestStore } from '@libs/app-root-shared-ts/request-scope';
import { appAuth } from '@libs/auth-shared-ts/auth-context';
import { requirePermission } from '@libs/permissions-shared-ts/require-permission';
import { mintPubSubToken } from '@libs/pubsub-server-ts/mint-pubsub-token';
import { PubsubSecretName } from '@libs/pubsub-shared-ts/secret-names';
import { defineSubServer, type SubServerCtx } from '@libs/sub-shared-ts/server';
import { SYNTHETIC_POPULATION_TOPIC } from '@libs/synthetic-population-shared-ts/synthetic-population-topic';
import { Hono } from 'hono';
import { notifySyntheticPopulation, readSecret } from './request-ports';
import { createSyntheticPopulationRoutes } from './synthetic-population-routes';

function routes(ctx: SubServerCtx) {
  const ports = {
    clock: ctx.clock,
    createId: ctx.createId,
    notify: notifySyntheticPopulation,
  };
  const administration = createSyntheticPopulationRoutes({
    getDb: ctx.getSqlClient,
    ports,
    subscriptionCredentials: async (actorId) => {
      const value = await mintPubSubToken({
        secret: await readSecret(PubsubSecretName.jwtSecret),
        actorId,
        featureTopics: [SYNTHETIC_POPULATION_TOPIC],
        now: ctx.clock.now,
      });
      return {
        username: 'jwt',
        password: value.token,
        expiresAt: value.expiresAt,
      };
    },
    authorize: async (request, permission) => {
      const store = requireRequestStore();
      const auth = appAuth(
        await store.sessionAuth.resolveAuthContext(store.sqlClient, request)
      );
      await requirePermission({
        db: store.sqlClient,
        auth,
        permission,
        nowMs: store.clock.now(),
      });
      return auth?.myId ?? '';
    },
  });
  return new Hono().route('/admin/synthetic-population', administration);
}

export const SYNTHETIC_POPULATION_ADMIN_SERVER = defineSubServer({
  name: 'population-administration',
  routes,
});
