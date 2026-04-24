import { registerServiceWorker, type PwaUpdatePrompt } from './register-service-worker';
import { Box, Button, Text } from '@gamezilla/shared/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

/**
 * Bottom banner when a new Workbox-generated service worker is waiting.
 */
export function PwaUpdatePromptBanner(): ReactNode {
  const [prompt, setPrompt] = useState<PwaUpdatePrompt | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    return registerServiceWorker(setPrompt);
  }, []);

  if (prompt === null) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        p: 4,
        background: 'surface',
        borderTopWidth: 1,
        borderTopColor: 'border',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 3,
      }}
    >
      <Text
        variant="bodyBold"
        label="New version available — reload to update"
        sx={{ flex: 1 }}
      />
      <Button title="Reload" onPress={() => prompt.reload()} />
    </Box>
  );
}
