import { useLingui } from '@lingui/react/macro';
import {
  Box,
  PaintbrushIcon,
  RegisterStatusBarItem,
  SegmentedControl,
  Text,
  useTheme,
  useThemePreference,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

function ThemeIndicator(): ReactNode {
  const theme = useTheme();
  return <PaintbrushIcon size={12} color={theme.colors.textSecondary} />;
}

function ThemePanel(): ReactNode {
  const { t } = useLingui();
  const { preference, setPreference } = useThemePreference();
  const segments = [
    { key: 'light' as const, label: t`Light` },
    { key: 'dark' as const, label: t`Dark` },
    { key: 'system' as const, label: t`System` },
  ];
  return (
    <Box sx={{ gap: 2 }}>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={t`Choose how the app looks.`}
      />
      <SegmentedControl
        segments={segments}
        selected={preference}
        onSelect={setPreference}
      />
    </Box>
  );
}

/**
 * Registers theme preference into the global status bar.
 */
export function ThemeStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const { preference } = useThemePreference();
  const caption =
    preference === 'light'
      ? t`Light`
      : preference === 'dark'
        ? t`Dark`
        : t`System`;

  return (
    <RegisterStatusBarItem
      id="theme"
      order={40}
      contentKey={preference}
      title={t`Theme`}
      caption={caption}
      accessibilityLabel={t`Theme: ${caption}`}
      indicator={<ThemeIndicator />}
      leading={<PaintbrushIcon size={18} />}
      panel={<ThemePanel />}
    />
  );
}
