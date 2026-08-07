import {
  formatCommitDate,
  getCommitDate,
  getCommitHash,
  getShortCommitHash,
} from '@apps/client/config/app-metadata';
import { i18n } from '@apps/client/i18n/i18n';
import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { APP_IDENTITY } from '@libs/auth/shared/app-identity';
import { Trans, useLingui } from '@lingui/react/macro';
import { Box, Card, CopyToClipboardField, ScreenBase, Text } from '@pkgs/ui';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function AboutScreen() {
  const { t } = useLingui();
  const nav = useBreadcrumbNav();
  const fullCommitHash = getCommitHash();
  const shortCommitHash = getShortCommitHash();
  const formattedCommitDate = formatCommitDate(getCommitDate(), i18n.locale);
  const appName =
    Constants.expoConfig?.name ??
    Constants.expoConfig?.slug ??
    APP_IDENTITY.displayName;
  const appVersion = Constants.expoConfig?.version ?? '—';

  const buildMode = __DEV__ ? t`development` : t`production`;
  const platformOs = Platform.OS;

  return (
    <ScreenBase
      screenId="about"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>About</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
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
            <Text
              variant="caption"
              label={t`Committed: ${formattedCommitDate}`}
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
        </Box>
      )}
    />
  );
}
