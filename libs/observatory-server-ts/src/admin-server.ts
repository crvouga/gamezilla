import { requireRequestStore } from '@libs/app-root-shared-ts/request-scope';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import { OBSERVATORY_TOPIC } from '@libs/observatory-shared-ts/live-session';
import { requirePermission } from '@libs/permissions-shared-ts/require-permission';
import { mintPubSubToken } from '@libs/pubsub-server-ts/mint-pubsub-token';
import { PubsubSecretName } from '@libs/pubsub-shared-ts/secret-names';
import { defineSubServer, type SubServer } from '@libs/sub-shared-ts/server';
import { Hono } from 'hono';
import { createObservatoryRoutes } from './observatory-routes';
import type { SyntheticPopulationPortFactory } from './ports';

import { authContext, observatoryPorts } from './request-ports';

async function pubsubSecret(): Promise<string> {
  const value = (
    await requireRequestStore().secretStore.getOptional(
      PubsubSecretName.jwtSecret
    )
  )?.readSecretValue();
  if (value === undefined || value.length < 32)
    throw new UnauthorizedError('Live updates are not configured');
  return value;
}

/**
 * The User Observatory's server: every app's live-session reports, and the
 * authorized reads of who is online now and watching them live. The
 * Synthetic Population says which accounts are Synthetic Users.
 */
export function createObservatoryAdminServer(
  population: SyntheticPopulationPortFactory
): SubServer {
  return defineSubServer({
    name: 'observatory',
    routes: (ctx) => {
      const ports = observatoryPorts(ctx, population);
      return new Hono().route(
        '/admin/observatory',
        createObservatoryRoutes({
          getDb: ctx.getSqlClient,
          ports,
          subscriptionCredentials: async (actorId) => {
            const value = await mintPubSubToken({
              secret: await pubsubSecret(),
              actorId,
              featureTopics: [OBSERVATORY_TOPIC],
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
            const auth = await authContext(request);
            await requirePermission({
              db: store.sqlClient,
              auth,
              permission,
              nowMs: store.clock.now(),
            });
            return auth?.myId ?? '';
          },
        })
      );
    },
  });
}
