/**
 * Playground snapshots persist via HTTP ObjectStore → Bun local report server →
 * Node-FS under `.cache/sim-console-data/playground-snapshots/`.
 */

import type { Timers } from '@pkgs/clock';
import {
  createHttpObjectStore,
  type ObjectStoreHttpFetch,
} from '@pkgs/object-store/impl-http';
import type { ObjectStore } from '@pkgs/object-store/interface';
import {
  DEFAULT_REPORT_SERVER_PORT,
  PLAYGROUND_SNAPSHOT_OBJECTS_PATH,
} from '@pkgs/sim-console/types';

export function playgroundSnapshotObjectsBaseUrl(
  port: number = DEFAULT_REPORT_SERVER_PORT
): string {
  return `http://127.0.0.1:${String(port)}${PLAYGROUND_SNAPSHOT_OBJECTS_PATH}`;
}

export type CreatePlaygroundSnapshotStoreOptions = {
  readonly fetch: ObjectStoreHttpFetch;
  readonly baseUrl?: string;
};

export function createPlaygroundSnapshotStore(
  _timers: Timers,
  options: CreatePlaygroundSnapshotStoreOptions
): ObjectStore {
  return createHttpObjectStore({
    baseUrl: options.baseUrl ?? playgroundSnapshotObjectsBaseUrl(),
    fetch: options.fetch,
  });
}
