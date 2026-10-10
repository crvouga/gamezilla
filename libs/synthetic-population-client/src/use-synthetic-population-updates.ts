import { useClientConfig } from '@libs/app-config-client/use-client-config';
import { useClientEnv } from '@libs/app-root-client/client-env-context';
import { SYNTHETIC_POPULATION_TOPIC } from '@libs/synthetic-population-shared/synthetic-population-topic';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createEffect, onCleanup } from 'solid-js';
import { useSyntheticPopulationApi } from './synthetic-population-api';

/** Best-effort invalidations; reconnect always rereads the authoritative typed RPC. */
export function useSyntheticPopulationUpdates(refresh: () => unknown): void {
  const env = useClientEnv();
  const config = useClientConfig();
  const api = useSyntheticPopulationApi();
  createEffect(() => {
    const url = config.config().emqx_wss_url;
    if (!url) return;
    const pubsub = env.createPubSub({
      url,
      clientIdPrefix: 'synthetic-population-observation',
      timers: env.timers,
      random: env.random,
      logger: createLogger({
        name: 'synthetic-population-observation',
        now: env.clock.now,
      }),
      auth: () => api.subscriptionCredentials(),
    });
    if (pubsub === null) return;
    let timer: unknown;
    const invalidate = () => {
      if (timer !== undefined) return;
      timer = env.timers.setTimeout(() => {
        timer = undefined;
        void refresh();
      }, 1000);
    };
    const unsubscribe = pubsub.subscribe(
      SYNTHETIC_POPULATION_TOPIC,
      invalidate
    );
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
