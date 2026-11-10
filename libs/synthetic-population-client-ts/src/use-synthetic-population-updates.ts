import { useClientConfig } from '@libs/app-config-client-ts/use-client-config';
import { useClientEnv } from '@libs/app-env-client-ts/client-env-context';
import {
  LIVE_FRAME_CHANGED,
  LIVE_PRESENCE_CHANGED,
  liveNotice,
} from '@libs/synthetic-population-shared-ts/live-session';
import { SYNTHETIC_POPULATION_TOPIC } from '@libs/synthetic-population-shared-ts/synthetic-population-topic';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { createEffect, onCleanup } from 'solid-js';
import { useSyntheticPopulationApi } from './synthetic-population-api';

/** Which notices a screen rereads on: the population's own, not live ones. */
export type UpdateFilter = (notice: {
  type: string;
  sessionId: string | null;
}) => boolean;

const POPULATION_CHANGES: UpdateFilter = (notice) =>
  notice.type !== LIVE_PRESENCE_CHANGED && notice.type !== LIVE_FRAME_CHANGED;

/** Rereads only when someone online now arrives, moves or leaves. */
export const PRESENCE_CHANGES: UpdateFilter = (notice) =>
  notice.type === LIVE_PRESENCE_CHANGED;

/**
 * Best-effort invalidations; reconnect always rereads the authoritative typed
 * RPC. `accept` picks the notices this screen rereads on.
 */
export function useSyntheticPopulationUpdates(
  refresh: () => unknown,
  accept: UpdateFilter = POPULATION_CHANGES,
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
    const unsubscribe = pubsub.subscribe(SYNTHETIC_POPULATION_TOPIC, (data) => {
      const notice = liveNotice(data);
      if (notice === null || accept(notice)) invalidate();
    });
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
 * Rereads every `everyMs` while no live-update channel is configured, so a
 * screen that must stay current does so even without one.
 */
export function useRefreshWithoutUpdates(
  refresh: () => unknown,
  everyMs: number,
  active: () => boolean = () => true
): void {
  const env = useClientEnv();
  const config = useClientConfig();
  createEffect(() => {
    if (config.config().emqx_wss_url || !active()) return;
    const id = env.timers.setInterval(() => void refresh(), everyMs);
    onCleanup(() => env.timers.clearInterval(id));
  });
}
