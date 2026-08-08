import { useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import {
  RegisterStatusBarItem,
  StatusDot,
  type StatusDotStatus,
} from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
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

/**
 * Registers online / sync connectivity into the global status bar.
 */
export function ConnectivityStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const { status: syncStatus, refreshQueries } = useSyncEngine();
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
  const caption =
    status === 'online'
      ? syncStatus.connection
      : syncError && syncStatus.lastError !== null
        ? syncStatus.lastError
        : label;
  const onPress = useCallback(() => {
    void refreshQueries();
  }, [refreshQueries]);

  return (
    <RegisterStatusBarItem
      id="connectivity"
      order={10}
      contentKey={`${status}:${syncStatus.connection}`}
      title={t`Online`}
      caption={caption}
      accessibilityLabel={label}
      active={status === 'online'}
      indicator={<StatusDot status={status} size={8} />}
      leading={<StatusDot status={status} size={14} />}
      onPress={onPress}
    />
  );
}
