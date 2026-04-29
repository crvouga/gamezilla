import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  Box,
  ScreenBase,
  SegmentedControl,
  Text,
  useThemePreference,
} from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

const THEME_SEGMENTS = [
  { key: 'light', label: '☀️ Light' },
  { key: 'dark', label: '🌙 Dark' },
  { key: 'system', label: '💻 System' },
] as const;

export function ThemeSettingsScreen() {
  const { preference, setPreference } = useThemePreference();
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        {
          name: 'Appearance',
          subtitle: 'Theme',
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
            segments={[...THEME_SEGMENTS]}
            selected={preference}
            onSelect={setPreference}
          />
        </Box>
      )}
    />
  );
}
