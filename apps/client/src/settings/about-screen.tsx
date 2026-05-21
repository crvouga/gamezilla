import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { getApiBaseUrl } from '@apps/client/config/api-servers';
import {
  getCommitHash,
  getShortCommitHash,
} from '@apps/client/config/app-metadata';
import { Box, Card, CopyToClipboardField, ScreenBase, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function AboutScreen() {
  const { t } = useLingui();
  const nav = useBreadcrumbNav();
  const fullCommitHash = getCommitHash();
  const shortCommitHash = getShortCommitHash();
  const apiOrigin = getApiBaseUrl();
  const appName =
    Constants.expoConfig?.name ??
    Constants.expoConfig?.slug ??
    String('gamezilla');
  const appVersion = Constants.expoConfig?.version ?? '—';

  const buildMode = __DEV__ ? t`development` : t`production`;
  const platformOs = Platform.OS;

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>About</Trans>,
          subtitle: <Trans>App version and build metadata</Trans>,
        },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label={<Trans>App</Trans>} />
            <Text variant="body" label={t`Name: ${appName}`} />
            <Text variant="body" label={t`Version: ${appVersion}`} />
          </Card>

          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label={<Trans>Build</Trans>} />
            <Text
              variant="caption"
              label={t`Commit (short): ${shortCommitHash}`}
            />
            <CopyToClipboardField
              label={<Trans>Full commit</Trans>}
              helperText={t`Tap to copy`}
              value={fullCommitHash}
              selectable
            />
            <Text variant="caption" label={t`Build mode: ${buildMode}`} />
            <Text variant="caption" label={t`Platform: ${platformOs}`} />
          </Card>

          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label={<Trans>API</Trans>} />
            <Text variant="body" selectable label={apiOrigin} />
          </Card>
        </Box>
      )}
    />
  );
}
