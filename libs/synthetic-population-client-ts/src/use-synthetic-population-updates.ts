import { useClientConfig } from '@libs/app-config-client-ts/use-client-config';
import { useClientEnv } from '@libs/app-env-client-ts/client-env-context';
import { SYNTHETIC_POPULATION_TOPIC } from '@libs/synthetic-population-shared-ts/synthetic-population-topic';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { createEffect, onCleanup } from 'solid-js';
import { useSyntheticPopulationApi } from './synthetic-population-api';

/**
 * Best-effort invalidations: any notice about the Synthetic Population
 * rereads; reconnect always rereads the authoritative typed RPC.
 */
export function useSyntheticPopulationUpdates(
  refresh: () => unknown,
  delayMs = 1000
): void {
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
      }, delayMs);
    };
    const unsubscribe = pubsub.subscribe(SYNTHETIC_POPULATION_TOPIC, () =>
      invalidate()
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

/**
 * Rereads every `everyMs` while no live-update channel is configured, so the
 * panel stays current even without one.
 */
export function useRefreshWithoutUpdates(
  refresh: () => unknown,
  everyMs: number
): void {
  const env = useClientEnv();
  const config = useClientConfig();
  createEffect(() => {
    if (config.config().emqx_wss_url) return;
    const id = env.timers.setInterval(() => void refresh(), everyMs);
    onCleanup(() => env.timers.clearInterval(id));
  });
}
