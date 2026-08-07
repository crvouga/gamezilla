import { useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import {
  Box,
  RegisterStatusBarItem,
  StatusDot,
  type StatusDotStatus,
  Text,
} from '@pkgs/ui';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform } from 'react-native';

function useBrowserOnline(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine !== false
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

function connectivityStatus(
  browserOnline: boolean,
  syncOnline: boolean,
  syncError: boolean
): StatusDotStatus {
  if (!browserOnline || !syncOnline) return 'offline';
  if (syncError) return 'warning';
  return 'online';
}

function ConnectivityPanel({
  status,
  connection,
  lastError,
}: {
  status: StatusDotStatus;
  connection: string;
  lastError: string | null;
}): ReactNode {
  const { t } = useLingui();
  const label =
    status === 'online'
      ? t`Online`
      : status === 'offline'
        ? t`Offline`
        : t`Sync issue`;
  return (
    <Box sx={{ gap: 1 }}>
      <Text variant="body" label={`${label} · ${connection}`} />
      {lastError !== null && lastError.length > 0 ? (
        <Text
          variant="caption"
          sx={{ color: 'destructive' }}
          label={lastError}
        />
      ) : (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={t`Changes sync when the connection is healthy.`}
        />
      )}
    </Box>
  );
}

/**
 * Registers online / sync connectivity into the global status bar.
 */
export function ConnectivityStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const syncStatus = useSyncEngine().status;
  const browserOnline = useBrowserOnline();
  const syncError =
    syncStatus.lastError !== null && syncStatus.lastError.length > 0;
  const status = connectivityStatus(
    browserOnline,
    syncStatus.online,
    syncError
  );
  const label =
    status === 'online'
      ? t`Online`
      : status === 'offline'
        ? t`Offline`
        : t`Sync issue`;

  return (
    <RegisterStatusBarItem
      id="connectivity"
      order={10}
      title={t`Connectivity`}
      caption={label}
      accessibilityLabel={label}
      indicator={<StatusDot status={status} size={8} />}
      leading={<StatusDot status={status} size={12} />}
      panel={
        <ConnectivityPanel
          status={status}
          connection={syncStatus.connection}
          lastError={syncStatus.lastError}
        />
      }
    />
  );
}
