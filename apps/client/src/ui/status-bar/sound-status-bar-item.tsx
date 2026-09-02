import { useLingui } from '@lingui/react/macro';
import { useSoundsPreference } from '@pkgs/sounds';
import {
  RegisterStatusBarItem,
  SoundIndicator,
  useRouter,
  useStatusBar,
  useTheme,
} from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

/**
 * Registers sound mute preference into the global status bar.
 */
export function SoundStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { close } = useStatusBar();
  const theme = useTheme();
  const { muted } = useSoundsPreference();
  const caption = muted ? t`Muted` : t`On`;
  const onPress = useCallback(() => {
    close();
    router.push('/more/sound');
  }, [close, router]);
  const active = !muted;
  const glyphColor = active ? theme.colors.onPrimary : undefined;

  return (
    <RegisterStatusBarItem
      id="sound"
      order={50}
      contentKey={muted}
      title={t`Sound`}
      caption={caption}
      accessibilityLabel={muted ? t`Sound muted` : t`Sound on`}
      active={active}
      indicator={
        <SoundIndicator
          state={muted ? 'muted' : 'idle'}
          size={12}
          backgroundColor="transparent"
        />
      }
      leading={
        <SoundIndicator
          state={muted ? 'muted' : 'idle'}
          size={18}
          backgroundColor="transparent"
          {...(glyphColor !== undefined
            ? { color: glyphColor, mutedColor: glyphColor }
            : {})}
        />
      }
      onPress={onPress}
    />
  );
}
