import { notifyUserChannels } from '@libs/app-root-server-ts/notify-user-channels';
import { requireRequestStore } from '@libs/app-root-shared-ts/request-scope';
import { appAuth } from '@libs/auth-shared-ts/auth-context';
import {
  LIVE_FRAME_CHANGED,
  LIVE_PRESENCE_CHANGED,
  OBSERVATORY_EVENT_PROTOCOL,
  OBSERVATORY_TOPIC,
} from '@libs/observatory-shared-ts/live-session';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import type { SubServerCtx } from '@libs/sub-shared-ts/server';
import type { ObservatoryPorts, SyntheticPopulationPortFactory } from './ports';

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

export function observatoryPorts(
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

export async function authContext(request: Request) {
  const store = requireRequestStore();
  return appAuth(
    await store.sessionAuth.resolveAuthContext(store.sqlClient, request)
  );
}
