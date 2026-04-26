import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { getApiBaseUrl } from '@gamezilla/domain/config/api-servers';
import {
  getCommitHash,
  getShortCommitHash,
} from '@gamezilla/domain/config/app-metadata';
import { Box, Card, CopyToClipboardField, ScreenBase, Text } from '@gamezilla/lib/ui';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function AboutScreen() {
  const nav = useBreadcrumbNav();
  const fullCommitHash = getCommitHash();
  const shortCommitHash = getShortCommitHash();
  const apiOrigin = getApiBaseUrl();
  const appName =
    Constants.expoConfig?.name ?? Constants.expoConfig?.slug ?? 'gamezilla';
  const appVersion = Constants.expoConfig?.version ?? '—';

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
            <Text
              variant="caption"
              label={`Commit (short): ${shortCommitHash}`}
            />
            <CopyToClipboardField
              label="Full commit"
              helperText="Tap to copy"
              value={fullCommitHash}
              selectable
            />
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
