import type { PerfListener, PerfSampler } from './types';
import { EMPTY_PERF_SNAPSHOT } from './types';

type ListenerRegistration = {
  readonly listener: PerfListener;
  unsubscribe: (() => void) | null;
};

/** Loads the browser-only sampler when the performance HUD is first enabled. */
export function createLazyPerfSampler(
  load: () => Promise<PerfSampler>
): PerfSampler {
  const registrations = new Set<ListenerRegistration>();
  let sampler: PerfSampler | null = null;
  let loading: Promise<void> | null = null;
  let active = false;

  const attach = (
    registration: ListenerRegistration,
    next: PerfSampler
  ): void => {
    registration.unsubscribe = next.subscribe(registration.listener);
  };

  const ensureLoaded = (): void => {
    if (sampler !== null || loading !== null) return;
    loading = load().then(
      (next) => {
        sampler = next;
        loading = null;
        for (const registration of registrations) attach(registration, next);
        if (active) next.start();
      },
      () => {
        // Optional diagnostics must not make the app fail to boot. A later
        // disable/enable cycle retries the chunk load.
        loading = null;
      }
    );
  };

  return {
    start: () => {
      active = true;
      if (sampler === null) ensureLoaded();
      else sampler.start();
    },
    stop: () => {
      active = false;
      sampler?.stop();
    },
    getSnapshot: () => sampler?.getSnapshot() ?? EMPTY_PERF_SNAPSHOT,
    subscribe: (listener) => {
      const registration: ListenerRegistration = {
        listener,
        unsubscribe: null,
      };
      registrations.add(registration);
      if (sampler !== null) attach(registration, sampler);
      return () => {
        registrations.delete(registration);
        registration.unsubscribe?.();
      };
    },
  };
}
