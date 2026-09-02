import { useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import {
  RegisterStatusBarItem,
  StatusDot,
  useRouter,
  useStatusBar,
} from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { resolveConnectivityStatus } from './resolve-connectivity-status';

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

/**
 * Registers online / sync connectivity into the global status bar.
 */
export function ConnectivityStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { close } = useStatusBar();
  const { status: syncStatus } = useSyncEngine();
  const browserOnline = useBrowserOnline();
  const syncError =
    syncStatus.lastError !== null && syncStatus.lastError.length > 0;
  const status = resolveConnectivityStatus({
    browserOnline,
    syncOnline: syncStatus.online,
    syncError,
    connection: syncStatus.connection,
    hasSynced: syncStatus.hasSynced,
  });
  const label =
    status === 'online'
      ? t`Online`
      : status === 'offline'
        ? t`Offline`
        : status === 'pending'
          ? t`Syncing`
          : t`Sync issue`;
  const caption =
    status === 'online'
      ? syncStatus.connection
      : status === 'pending'
        ? syncStatus.connection
        : status === 'warning'
          ? t`Error`
          : label;
  const onPress = useCallback(() => {
    close();
    router.push('/more/sync');
  }, [close, router]);

  return (
    <RegisterStatusBarItem
      id="connectivity"
      order={10}
      contentKey={`${status}:${syncStatus.connection}`}
      title={label}
      caption={caption}
      accessibilityLabel={label}
      active={status === 'online'}
      indicator={<StatusDot status={status} size={8} />}
      leading={<StatusDot status={status} size={14} />}
      onPress={onPress}
    />
  );
}
