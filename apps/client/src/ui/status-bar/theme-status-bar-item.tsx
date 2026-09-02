import { useLingui } from '@lingui/react/macro';
import {
  PaintbrushIcon,
  RegisterStatusBarItem,
  useRouter,
  useStatusBar,
  useThemePreference,
} from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

/**
 * Registers theme preference into the global status bar.
 */
export function ThemeStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { close } = useStatusBar();
  const { preference } = useThemePreference();
  const caption =
    preference === 'light'
      ? t`Light`
      : preference === 'dark'
        ? t`Dark`
        : t`System`;
  const onPress = useCallback(() => {
    close();
    router.push('/more/theme');
  }, [close, router]);

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
