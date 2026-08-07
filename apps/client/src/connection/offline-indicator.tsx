import { useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import { Box, borderRadius, Text } from '@pkgs/ui';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform, Pressable } from 'react-native';

/**
 * Shows when the browser is offline or API sync has failed.
 */
export function OfflineIndicator(): ReactNode {
  const { t } = useLingui();
  const syncStatus = useSyncEngine().status;
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const goOnline = (): void => {
      setOffline(false);
    };
    const goOffline = (): void => {
      setOffline(true);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const syncError =
    syncStatus.lastError !== null && syncStatus.lastError.length > 0;
  const visible = offline || syncError;
  if (!visible) {
    return null;
  }

  const label = offline ? t`Offline` : t`Sync issue`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(
            t`Your changes are saved locally and will sync when you are back online.`
          );
        }
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 1,
          borderRadius: borderRadius.full,
          background: 'destructive',
          opacity: 0.95,
        }}
      >
        <Text variant="caption" sx={{ color: 'onDestructive' }} label={label} />
      </Box>
    </Pressable>
  );
}
