import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  Box,
  ScreenBase,
  SegmentedControl,
  Text,
  useThemePreference,
} from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';

export function ThemeSettingsScreen() {
  const { t } = useLingui();
  const { preference, setPreference } = useThemePreference();
  const nav = useBreadcrumbNav();

  const themeSegments = [
    { key: 'light' as const, label: t`☀️ Light` },
    { key: 'dark' as const, label: t`🌙 Dark` },
    { key: 'system' as const, label: t`💻 System` },
  ];

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>Appearance</Trans>,
          subtitle: <Trans>Theme</Trans>,
        },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <Text
            variant="body"
            label={
              <Trans>
                Choose how the app looks. System matches your device appearance.
              </Trans>
            }
          />
          <SegmentedControl
            segments={themeSegments}
            selected={preference}
            onSelect={setPreference}
          />
        </Box>
      )}
    />
  );
}
