import { borderRadius, Box, Text } from '@pkgs/ui';
import { SYNC_ERROR_TOPIC } from '@pkgs/patch-db/impl-sync';
import { usePubSub } from '@pkgs/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable } from 'react-native';

/**
 * Shows when the browser is offline or patch-db sync has failed repeatedly.
 */
export function OfflineIndicator(): ReactNode {
  const { t } = useLingui();
  const pubSub = usePubSub();
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const goOnline = (): void => {
      setOffline(false);
      setSyncError(false);
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

  useEffect(() => {
    return pubSub.subscribe(SYNC_ERROR_TOPIC, () => {
      setSyncError(true);
    });
  }, [pubSub]);

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
