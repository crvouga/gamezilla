import { useClientConfig } from '@libs/app-config-client-ts/use-client-config';
import { useClientEnv } from '@libs/app-env-client-ts/client-env-context';
import {
  LIVE_PRESENCE_CHANGED,
  liveNotice,
  OBSERVATORY_TOPIC,
} from '@libs/observatory-shared-ts/live-session';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { createEffect, onCleanup } from 'solid-js';
import { useObservatoryApi } from './observatory-api';

/** Which notices a screen rereads on. */
export type UpdateFilter = (notice: {
  type: string;
  sessionId: string | null;
}) => boolean;

/** Rereads only when someone online now arrives, moves or leaves. */
export const PRESENCE_CHANGES: UpdateFilter = (notice) =>
  notice.type === LIVE_PRESENCE_CHANGED;

/**
 * Best-effort invalidations; reconnect always rereads the authoritative typed
 * RPC. `accept` picks the notices this screen rereads on.
 */
export function useObservatoryUpdates(
  refresh: () => unknown,
  accept: UpdateFilter,
  delayMs = 1000
): void {
  const env = useClientEnv();
  const config = useClientConfig();
  const api = useObservatoryApi();
  createEffect(() => {
    const url = config.config().emqx_wss_url;
    if (!url) return;
    const pubsub = env.createPubSub({
      url,
      clientIdPrefix: 'user-observatory',
      timers: env.timers,
      random: env.random,
      logger: createLogger({ name: 'user-observatory', now: env.clock.now }),
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
    const unsubscribe = pubsub.subscribe(OBSERVATORY_TOPIC, (data) => {
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
