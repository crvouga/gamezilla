import {
  formatCommitDate,
  getCommitDate,
  getCommitHash,
  getShortCommitHash,
} from '@apps/client/config/app-metadata';
import { i18n } from '@apps/client/i18n/i18n';
import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { APP_IDENTITY } from '@libs/auth/public/app-identity';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  CopyToClipboardField,
  MenuRow,
  MenuSection,
  ScreenBase,
} from '@pkgs/ui';
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

  const buildMode = __DEV__ ? t`Development` : t`Production`;
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
        <Box sx={[sx, { gap: 5 }]}>
          <MenuSection title={<Trans>App</Trans>}>
            <MenuRow title={t`Name`} value={appName} />
            <MenuRow title={t`Version`} value={appVersion} />
            <MenuRow title={t`Platform`} value={platformOs} />
            <MenuRow title={t`Build mode`} value={buildMode} />
          </MenuSection>

          <MenuSection title={<Trans>Build</Trans>}>
            <MenuRow title={t`Commit`} value={shortCommitHash} />
            <MenuRow title={t`Committed`} value={formattedCommitDate} />
          </MenuSection>

          <CopyToClipboardField
            label={<Trans>Full commit</Trans>}
            helperText={t`Tap to copy`}
            value={fullCommitHash}
            selectable
          />
        </Box>
      )}
    />
  );
}
