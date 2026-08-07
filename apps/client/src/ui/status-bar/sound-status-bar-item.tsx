import { useLingui } from '@lingui/react/macro';
import { useSoundsPreference } from '@pkgs/sounds';
import {
  Box,
  RegisterStatusBarItem,
  SoundIndicator,
  Switch,
  Text,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

function SoundPanel(): ReactNode {
  const { t } = useLingui();
  const { muted, setMuted } = useSoundsPreference();
  return (
    <Box sx={{ gap: 2 }}>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={t`Mute turns off all app sounds.`}
      />
      <Switch label={t`Mute sounds`} value={muted} onValueChange={setMuted} />
    </Box>
  );
}

/**
 * Registers sound mute preference into the global status bar.
 */
export function SoundStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const { muted } = useSoundsPreference();
  const caption = muted ? t`Muted` : t`On`;

  return (
    <RegisterStatusBarItem
      id="sound"
      order={50}
      contentKey={muted}
      title={t`Sound`}
      caption={caption}
      accessibilityLabel={muted ? t`Sound muted` : t`Sound on`}
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
          size={16}
          backgroundColor="transparent"
        />
      }
      panel={<SoundPanel />}
    />
  );
}
