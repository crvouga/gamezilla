import { notifyUserChannels } from '@libs/app-root-server/notify-user-channels';
import { requireRequestStore } from '@libs/app-root-shared/request-scope';
import { appAuth } from '@libs/auth-shared/auth-context';
import { UnauthorizedError } from '@libs/auth-shared/unauthorized-error';
import {
  defineFeatureServer,
  type FeatureServerCtx,
} from '@libs/feature-shared/server';
import { requirePermission } from '@libs/permissions-shared/require-permission';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server/create-http-pubsub-from-secret-store';
import { mintPubSubToken } from '@libs/pubsub-server/mint-pubsub-token';
import { PubsubSecretName } from '@libs/pubsub-shared/secret-names';
import {
  SYNTHETIC_POPULATION_EVENT_PROTOCOL,
  SYNTHETIC_POPULATION_TOPIC,
} from '@libs/synthetic-population-shared/synthetic-population-topic';
import { Hono } from 'hono';
import { bindSyntheticPopulationAccount } from './account-binding';
import {
  authorizeSyntheticPopulationMutation,
  authorizeSyntheticPopulationSession,
  syntheticPopulationRoomGrants,
} from './session-fencing';
import { createSyntheticPopulationRoutes } from './synthetic-population-routes';
import { createSyntheticPopulationWorkerRoutes } from './worker-routes';

async function readSecret(name: string): Promise<string> {
  const value = (
    await requireRequestStore().secretStore.getOptional(name)
  )?.readSecretValue();
  if (value === undefined || value.length < 32)
    throw new UnauthorizedError('Synthetic Population is not configured');
  return value;
}

async function notifySyntheticPopulation(): Promise<void> {
  const store = requireRequestStore();
  const pubsub = await new HttpPubSubFromSecretStore(
    store.secretStore,
    store.clock.now
  ).get();
  if (pubsub === undefined) return;
  await pubsub.publish(SYNTHETIC_POPULATION_TOPIC, {
    type: 'synthetic-population-changed',
    protocolVersion: SYNTHETIC_POPULATION_EVENT_PROTOCOL,
  });
}

function routes(ctx: FeatureServerCtx) {
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
  const workers = createSyntheticPopulationWorkerRoutes({
    getDb: ctx.getSqlClient,
    ports,
    credentialSecret: () => readSecret('POPULATION_CREDENTIAL_SECRET'),
    bindAccount: (lease, token) =>
      bindSyntheticPopulationAccount(
        {
          db: ctx.getSqlClient(),
          authServer: ctx.authServer,
          ports,
          notifyProfile: (accountId) =>
            notifyUserChannels(
              [accountId],
              'synthetic-population-account-classification',
              { tables: ['profile'] }
            ),
        },
        lease,
        token
      ),
    authorize: async (request) => {
      const expected = await readSecret('POPULATION_WORKER_TOKEN');
      const presented = request.headers.get('authorization')?.slice(7) ?? '';
      let different = presented.length ^ expected.length;
      for (let i = 0; i < expected.length; i += 1)
        different |= expected.charCodeAt(i) ^ (presented.charCodeAt(i) || 0);
      if (
        !request.headers.get('authorization')?.startsWith('Bearer ') ||
        different !== 0
      )
        throw new UnauthorizedError(
          'Synthetic Population Worker authentication required'
        );
    },
  });
  return new Hono()
    .route('/admin/synthetic-population', administration)
    .route('/synthetic-population-worker', workers);
}

export const SYNTHETIC_POPULATION_SERVER = defineFeatureServer({
  name: 'synthetic-population',
  routes,
  authorizeSession: authorizeSyntheticPopulationSession,
  authorizeMutation: authorizeSyntheticPopulationMutation,
  roomGrants: syntheticPopulationRoomGrants,
});
