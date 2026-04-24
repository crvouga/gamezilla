import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { getApiBaseUrl } from '@gamezilla/shared/config/api-servers';
import {
  getCommitHash,
  getShortCommitHash,
} from '@gamezilla/shared/config/app-metadata';
import { Box, Card, Pressable, ScreenBase, Text } from '@gamezilla/shared/ui';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const COPIED_RESET_MS = 2000;

export default function AboutScreen() {
  const nav = useBreadcrumbNav();
  const fullCommitHash = getCommitHash();
  const shortCommitHash = getShortCommitHash();
  const apiOrigin = getApiBaseUrl();
  const appName =
    Constants.expoConfig?.name ?? Constants.expoConfig?.slug ?? 'gamezilla';
  const appVersion = Constants.expoConfig?.version ?? '—';
  const [copied, setCopied] = useState(false);

  const onCopyHash = useCallback(async () => {
    await Clipboard.setStringAsync(fullCommitHash);
    setCopied(true);
  }, [fullCommitHash]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(id);
  }, [copied]);

  const buildMode = __DEV__ ? 'development' : 'production';

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        {
          name: 'About',
          subtitle: 'App version and build metadata',
        },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label="App" />
            <Text variant="body" label={`Name: ${appName}`} />
            <Text variant="body" label={`Version: ${appVersion}`} />
          </Card>

          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label="Build" />
            <Text variant="caption" label={`Commit (short): ${shortCommitHash}`} />
            <Pressable onPress={onCopyHash}>
              <Box sx={{ gap: 1, py: 2 }}>
                <Text variant="caption" label="Full commit (tap to copy)" />
                <Text variant="body" selectable label={fullCommitHash} />
              </Box>
            </Pressable>
            {copied ? (
              <Text variant="caption" label="Copied to clipboard" />
            ) : null}
            <Text variant="caption" label={`Build mode: ${buildMode}`} />
            <Text variant="caption" label={`Platform: ${Platform.OS}`} />
          </Card>

          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label="API" />
            <Text variant="body" selectable label={apiOrigin} />
          </Card>
        </Box>
      )}
    />
  );
}
