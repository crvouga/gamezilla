/** @jsxImportSource solid-js */
/**
 * `/more/server-status` — Connection in Settings. Says whether the app is
 * connected, and if not whether that is the person's choice, their device,
 * or the product out of reach; when it last was; the app's version; and what
 * still works without a connection. Built only on the shell's existing
 * signals (device network, work offline, origin availability, sync status).
 */

import { APP_VERSION } from '@libs/app-root-shared-ts/app-metadata';
import { useOptionalOriginAvailability } from '@pkgs/http-client-client-ts/solid';
import type { JSX } from 'solid-js';
import { createConnectionCause } from './connection-copy';
import { ConnectionScreenView } from './connection-screen-view';
import { useSyncStatus } from './sync-status-context';

export default function MoreServerStatusScreen(): JSX.Element {
  const sync = useSyncStatus();
  const availability = useOptionalOriginAvailability();
  const cause = createConnectionCause(() => {
    const status = sync();
    return (
      status.connection === 'connected' &&
      status.hasSynced &&
      status.online &&
      (status.lastError === null || status.lastError.length === 0)
    );
  });
  return (
    <ConnectionScreenView
      cause={cause()}
      lastSyncedAtMs={sync().lastSyncedAtMs}
      version={APP_VERSION}
      onCheckAgain={() => {
        void availability?.refresh();
      }}
    />
  );
}
