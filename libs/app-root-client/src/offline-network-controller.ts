import { asKeyword } from '@pkgs/keyword-shared/keyword';
import type { Kv } from '@pkgs/kv-root-shared/interface';
import { booleanKvCodec } from '@pkgs/kv-root-shared/kv-state-codec';

const OFFLINE_ROW_KEY = asKeyword('app.prefs/work-offline');
const OFFLINE_VALUE_ATTR = asKeyword('app.prefs/value');
const OFFLINE_CODEC = booleanKvCodec(OFFLINE_VALUE_ATTR);

export async function readOfflineNetworkPreference(kv: Kv): Promise<boolean> {
  const record = await kv.get(OFFLINE_ROW_KEY);
  return record === null ? false : (OFFLINE_CODEC.decode(record) ?? false);
}

export type OfflineNetworkController = {
  readonly isOffline: () => boolean;
  readonly setOffline: (offline: boolean) => void;
  readonly subscribe: (listener: (offline: boolean) => void) => () => void;
  /** Settles after the persisted choice has been read. */
  readonly ready: () => Promise<void>;
  /** Settles after writes requested so far have completed. */
  readonly persisted: () => Promise<void>;
};

/**
 * Local, persisted network kill switch. It deliberately starts offline so a
 * prior choice cannot leak traffic while storage is still hydrating.
 */
export function createOfflineNetworkController(
  kv: Kv
): OfflineNetworkController {
  const listeners = new Set<(offline: boolean) => void>();
  let offline = true;
  let generation = 0;
  let persistence = Promise.resolve();
  const notify = (): void => {
    for (const listener of [...listeners]) listener(offline);
  };
  const hydrationGeneration = generation;
  const hydration = readOfflineNetworkPreference(kv)
    .then((storedOffline) => {
      if (generation !== hydrationGeneration) return;
      offline = storedOffline;
      notify();
    })
    .catch(() => {
      // Storage uncertainty stays fail-closed.
    });
  return {
    isOffline: () => offline,
    setOffline(next) {
      generation += 1;
      if (offline !== next) {
        offline = next;
        notify();
      }
      persistence = persistence
        .then(() => kv.put(OFFLINE_ROW_KEY, OFFLINE_CODEC.encode(next)))
        .catch(() => undefined);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ready: () => hydration,
    persisted: () => persistence,
  };
}
