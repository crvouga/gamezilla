/** @jsxImportSource solid-js */
/**
 * `/more/sync` — local database + sync engine state from the shell's
 * `SyncStatusContext`; "Retry sync" re-runs the engine's query refresh.
 * Refused changes no screen tells where they live are listed here, each
 * dismissible.
 */

import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { JSX } from 'solid-js';
import { OtherRefusedChanges } from '@libs/app-env-client-ts/refused-change-notice';
import { SyncScreenView } from './sync-screen-view';
import { useSyncStatus } from './sync-status-context';

/** `/more/sync`: wires `SyncScreenView` to the sync engine. */
export function SyncScreen(): JSX.Element {
  const status = useSyncStatus();
  const engine = useSyncEngine();
  return (
    <SyncScreenView
      status={status()}
      refusedChanges={<OtherRefusedChanges />}
      onRetry={() => {
        void engine.refreshQueries();
      }}
    />
  );
}
