import { ScreenHeader } from '@/ui/screen-header';
import {
  Box,
  SegmentedControl,
  Text,
  useThemePreference,
} from '@gamezilla/shared/ui';

const THEME_SEGMENTS = [
  { key: 'light', label: '☀️ Light' },
  { key: 'dark', label: '🌙 Dark' },
  { key: 'system', label: '💻 System' },
] as const;

export default function ThemeSettingsScreen() {
  const { preference, setPreference } = useThemePreference();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="Appearance" subtitle="Theme" fallbackHref="/more" />
      <Box sx={{ flex: 1, px: 4, py: 4, gap: 3 }}>
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
    </Box>
  );
}
