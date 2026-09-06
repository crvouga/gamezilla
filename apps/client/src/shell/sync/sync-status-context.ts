/**
 * Shell-level live sync status for chrome (offline banner, global menu).
 * Type-only dependency on `@pkgs/sync-engine/client` so chrome stays in the
 * initial chunk while the engine + `@pkgs/sync-engine/solid` bindings load
 * lazily (`sync-engine-ready-tree.tsx`, which mounts this provider).
 */

import { defineContext } from '@pkgs/solid-context/define-context';
import type { SyncEngineStatus } from '@pkgs/sync-engine/client';
import type { Accessor } from 'solid-js';

const SyncStatusContext =
  defineContext<Accessor<SyncEngineStatus>>('SyncStatus');

export const SyncStatusProvider = SyncStatusContext.Provider;
/** Tracked live sync status; throws when no engine tree is mounted. */
export const useSyncStatus = SyncStatusContext.use;
