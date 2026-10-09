import { useClientConfig } from '@libs/app-config-client/use-client-config';
import { useClientEnv } from '@libs/app-root-client/client-env-context';
import { createObservationPubSub } from '@libs/app-root-client/create-client-pubsub';
import { POPULATION_TOPIC } from '@libs/population-shared/population-topic';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createEffect, onCleanup } from 'solid-js';
import { usePopulationApi } from './population-api';

/** Best-effort invalidations; reconnect always rereads the authoritative typed RPC. */
export function usePopulationUpdates(refresh: () => unknown): void {
  const env = useClientEnv();
  const config = useClientConfig();
  const api = usePopulationApi();
  createEffect(() => {
    const url = config.config().emqx_wss_url;
    if (!url) return;
    const pubsub =
      env.createPubSub?.() ??
      createObservationPubSub({
        url,
        clientIdPrefix: 'population-observation',
        timers: env.timers,
        random: env.random,
        logger: createLogger({
          name: 'population-observation',
          now: env.clock.now,
        }),
        auth: () => api.subscriptionCredentials(),
      });
    let timer: unknown;
    const invalidate = () => {
      if (timer !== undefined) return;
      timer = env.timers.setTimeout(() => {
        timer = undefined;
        void refresh();
      }, 1000);
    };
    const unsubscribe = pubsub.subscribe(POPULATION_TOPIC, invalidate);
    const status = pubsub.onStatus((value) => {
      if (value === 'connected') invalidate();
    });
    onCleanup(() => {
      env.timers.clearTimeout(timer);
      unsubscribe();
      status();
      pubsub.close();
    });
  });
}
