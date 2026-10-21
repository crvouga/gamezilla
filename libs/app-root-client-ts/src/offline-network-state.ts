import {
  type NetworkState,
  type NetworkStatePort,
  networkStateNone,
} from '@pkgs/device-shared-ts/network-state';
import { HttpAbortError } from '@pkgs/http-client-shared-ts/http-abort-error';
import type { OriginAvailability } from '@pkgs/http-client-shared-ts/origin-availability';
import type { OfflineNetworkController } from './offline-network-controller';

/** Voluntary offline is exposed as a disconnected device to every consumer. */
export function createOfflineNetworkState(
  offline: OfflineNetworkController,
  physical: NetworkStatePort
): NetworkStatePort {
  return {
    getState: async () =>
      offline.isOffline() ? networkStateNone() : await physical.getState(),
    subscribe(listener) {
      let physicalState: NetworkState = networkStateNone();
      const emit = (): void =>
        listener(offline.isOffline() ? networkStateNone() : physicalState);
      const stopPhysical = physical.subscribe((state) => {
        physicalState = state;
        emit();
      });
      const stopOffline = offline.subscribe(emit);
      return () => {
        stopPhysical();
        stopOffline();
      };
    },
  };
}

/** Health probing is stopped while voluntary offline is enabled. */
export function createOfflineOriginAvailability(
  offline: OfflineNetworkController,
  physical: OriginAvailability
): OriginAvailability {
  let started = false;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const stopPhysical = physical.subscribe(notify);
  const stopOffline = offline.subscribe((closed) => {
    if (closed) physical.stop();
    else if (started) physical.start();
    notify();
  });
  const waitUntilOnline = (signal?: AbortSignal | null): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(new HttpAbortError());
        return;
      }
      const stop = offline.subscribe((closed) => {
        if (closed) return;
        stop();
        signal?.removeEventListener('abort', abort);
        void physical.waitUntilAvailable(signal).then(resolve, reject);
      });
      const abort = (): void => {
        stop();
        reject(new HttpAbortError());
      };
      signal?.addEventListener('abort', abort, { once: true });
    });
  return {
    kind: physical.kind,
    getSnapshot: () =>
      offline.isOffline()
        ? {
            phase: 'unavailable',
            lastLatencyMs: null,
            healthUrl: physical.getSnapshot().healthUrl,
          }
        : physical.getSnapshot(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      started = true;
      if (!offline.isOffline()) physical.start();
    },
    stop() {
      started = false;
      physical.stop();
      stopPhysical();
      stopOffline();
      listeners.clear();
    },
    waitUntilAvailable: (signal) =>
      offline.isOffline()
        ? waitUntilOnline(signal)
        : physical.waitUntilAvailable(signal),
    noteNetworkFailure: () => physical.noteNetworkFailure(),
    noteSuccess: () => {
      if (!offline.isOffline()) physical.noteSuccess();
    },
    isHealthProbeUrl: physical.isHealthProbeUrl,
    matchesOrigin: physical.matchesOrigin,
    refresh: () =>
      offline.isOffline() ? Promise.resolve() : physical.refresh(),
  };
}
