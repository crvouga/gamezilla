import { notifyUserChannels } from '@libs/app-root-server-ts/notify-user-channels';
import { requireRequestStore } from '@libs/app-root-shared-ts/request-scope';
import { appAuth } from '@libs/auth-shared-ts/auth-context';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import {
  LIVE_FRAME_CHANGED,
  LIVE_PRESENCE_CHANGED,
  OBSERVATORY_EVENT_PROTOCOL,
  OBSERVATORY_TOPIC,
} from '@libs/observatory-shared-ts/live-session';
import { requirePermission } from '@libs/permissions-shared-ts/require-permission';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import { mintPubSubToken } from '@libs/pubsub-server-ts/mint-pubsub-token';
import { PubsubSecretName } from '@libs/pubsub-shared-ts/secret-names';
import {
  defineSubServer,
  type SubServer,
  type SubServerCtx,
} from '@libs/sub-shared-ts/server';
import { Hono } from 'hono';
import { createLiveReportRoutes } from './live-routes';
import { createObservatoryRoutes } from './observatory-routes';
import type { ObservatoryPorts, SyntheticPopulationPortFactory } from './ports';

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

async function publishObservatory(
  message: Readonly<Record<string, unknown>>
): Promise<void> {
  const store = requireRequestStore();
  const pubsub = await new HttpPubSubFromSecretStore(
    store.secretStore,
    store.clock.now,
    store.http
  ).get();
  if (pubsub === undefined) return;
  await pubsub.publish(OBSERVATORY_TOPIC, {
    ...message,
    protocolVersion: OBSERVATORY_EVENT_PROTOCOL,
  });
}

function observatoryPorts(
  ctx: SubServerCtx,
  population: SyntheticPopulationPortFactory
): ObservatoryPorts {
  return {
    clock: ctx.clock,
    createId: ctx.createId,
    population: population({ clock: ctx.clock, createId: ctx.createId }),
    presenceChanged: () => publishObservatory({ type: LIVE_PRESENCE_CHANGED }),
    frameChanged: (sessionId) =>
      publishObservatory({ type: LIVE_FRAME_CHANGED, sessionId }),
    wakeAccount: (accountId) =>
      notifyUserChannels([accountId], 'observatory-live-watch', {
        tables: ['population_live_watches'],
      }),
  };
}

async function authContext(request: Request) {
  const store = requireRequestStore();
  return appAuth(
    await store.sessionAuth.resolveAuthContext(store.sqlClient, request)
  );
}

/** The app's own account and device; an unidentified request reports nothing. */
async function identifyLiveDevice(request: Request) {
  const auth = await authContext(request);
  const accountId = auth?.myId ?? '';
  const deviceId = auth?.deviceId ?? '';
  return accountId.length > 0 && deviceId.length > 0
    ? { accountId, deviceId }
    : null;
}

/**
 * The User Observatory's server: every app's live-session reports, and the
 * authorized reads of who is online now and watching them live. The
 * Synthetic Population says which accounts are Synthetic Users.
 */
export function createObservatoryServer(
  population: SyntheticPopulationPortFactory
): SubServer {
  return defineSubServer({
    name: 'observatory',
    routes: (ctx) => {
      const ports = observatoryPorts(ctx, population);
      return new Hono()
        .route(
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
        )
        .route(
          '/observatory-live',
          createLiveReportRoutes({
            getDb: ctx.getSqlClient,
            ports,
            identify: identifyLiveDevice,
          })
        );
    },
  });
}
