import {
  Box,
  ScreenBase,
  SegmentedControl,
  Text,
  useThemePreference,
} from '@gamezilla/shared/ui';

import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';

const THEME_SEGMENTS = [
  { key: 'light', label: '☀️ Light' },
  { key: 'dark', label: '🌙 Dark' },
  { key: 'system', label: '💻 System' },
] as const;

export default function ThemeSettingsScreen() {
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
            label="Choose how the app looks. System matches your device appearance."
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
