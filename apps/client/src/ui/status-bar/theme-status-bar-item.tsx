import { useLingui } from '@lingui/react/macro';
import {
  PaintbrushIcon,
  RegisterStatusBarItem,
  type ThemePreference,
  useThemePreference,
} from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

const THEME_CYCLE: readonly ThemePreference[] = ['light', 'dark', 'system'];

function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_CYCLE.indexOf(current);
  const safeIndex = index < 0 ? 0 : index;
  return THEME_CYCLE[(safeIndex + 1) % THEME_CYCLE.length] ?? 'system';
}

/**
 * Registers theme preference into the global status bar.
 */
export function ThemeStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const { preference, setPreference } = useThemePreference();
  const caption =
    preference === 'light'
      ? t`Light`
      : preference === 'dark'
        ? t`Dark`
        : t`System`;
  const onPress = useCallback(() => {
    setPreference(nextThemePreference(preference));
  }, [preference, setPreference]);

  return (
    <RegisterStatusBarItem
      id="theme"
      order={40}
      contentKey={preference}
      title={t`Theme`}
      caption={caption}
      accessibilityLabel={t`Theme: ${caption}`}
      active={preference !== 'system'}
      indicator={<PaintbrushIcon size={12} />}
      leading={<PaintbrushIcon size={20} />}
      onPress={onPress}
    />
  );
}
