import { SYNC_ERROR_TOPIC } from '@gamezilla/patch-db/impl-sync';
import { PatchDbSyncPubSubToken } from '@gamezilla/patch-db/react';
import { useDependency } from '@gamezilla/shared/dependency-injection/react';
import { Box, Text } from '@gamezilla/shared/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable } from 'react-native';

/**
 * Shows when the browser is offline or patch-db sync has failed repeatedly.
 */
export function OfflineIndicator(): ReactNode {
  const pubSub = useDependency(PatchDbSyncPubSubToken);
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

  const label = offline ? 'Offline' : 'Sync issue';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(
            'Your changes are saved locally and will sync when you are back online.'
          );
        }
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 1,
          borderRadius: 9999,
          background: 'destructive',
          opacity: 0.95,
        }}
      >
        <Text variant="caption" label={label} style={{ color: '#ffffff' }} />
      </Box>
    </Pressable>
  );
}
