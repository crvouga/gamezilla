/**
 * Shell-level live sync status for chrome (offline banner, global menu).
 * Type-only dependency on `@pkgs/sync-engine/client` so chrome stays in the
 * initial chunk while the engine + `@pkgs/sync-engine/solid` bindings load
 * lazily (`sync-engine-ready-tree.tsx`).
 *
 * Chrome mounts **outside** the ready tree (paint-before-SQLite). A boot-time
 * {@link SyncStatusRoot} supplies a stub; the ready tree publishes the live
 * engine status into the same signal so ancestors keep working.
 */

import { defineContext } from '@pkgs/solid-context/define-context';
import type { SyncEngineStatus } from '@pkgs/sync-engine/client';
import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
} from 'solid-js';

/** Mirrors `INITIAL_SYNC_STATUS` without a value import from sync-engine/client. */
export const BOOT_SYNC_STATUS: SyncEngineStatus = {
  connection: 'disconnected',
  online: true,
  hasSynced: false,
  hasEverSynced: false,
  lastError: null,
};

const SyncStatusContext =
  defineContext<Accessor<SyncEngineStatus>>('SyncStatus');

type SyncStatusPublisher = (status: SyncEngineStatus) => void;

const SyncStatusPublisherContext = defineContext<SyncStatusPublisher>(
  'SyncStatusPublisher'
);

export const SyncStatusProvider = SyncStatusContext.Provider;

/** Tracked live sync status; throws when no {@link SyncStatusRoot} is mounted. */
export const useSyncStatus = SyncStatusContext.use;

export function useSyncStatusPublisher(): SyncStatusPublisher {
  return SyncStatusPublisherContext.use();
}

/**
 * Boot-time status for chrome above the SQLite gate. Nest under
 * `ClientEnvProvider` / shell; the ready tree calls {@link useSyncStatusPublisher}.
 */
export function SyncStatusRoot(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [status, setStatus] = createSignal(BOOT_SYNC_STATUS);
  return (
    <SyncStatusPublisherContext.Provider value={setStatus}>
      <SyncStatusProvider value={status}>{props.children}</SyncStatusProvider>
    </SyncStatusPublisherContext.Provider>
  );
}

/**
 * Pushes `engine.status` into the outer {@link SyncStatusRoot} while mounted.
 * Must run under `SyncEngineProvider` + {@link SyncStatusRoot}.
 */
export function SyncStatusLiveBridge(props: {
  readonly children: JSX.Element;
  readonly status: Accessor<SyncEngineStatus>;
}): JSX.Element {
  const publish = useSyncStatusPublisher();
  createEffect(() => {
    publish(props.status());
  });
  onCleanup(() => {
    publish(BOOT_SYNC_STATUS);
  });
  return <>{props.children}</>;
}
