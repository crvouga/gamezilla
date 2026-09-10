/** @jsxImportSource solid-js */
/** `/more/sound` — in-app sound effects mute toggle (`@pkgs/sounds/solid`). */

import { Trans, useLingui } from '@lingui/solid/macro';
import { useSoundsPreference } from '@pkgs/sounds/solid';
import {
  MenuRow,
  MenuSection,
  ScreenBase,
  Switch,
  Volume2Icon,
  VolumeXIcon,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

const ROW_ICON_SIZE = 20;

export function SoundSettingsScreen(): JSX.Element {
  const { t } = useLingui();
  const { muted, setMuted } = useSoundsPreference();

  return (
    <ScreenBase
      screenId="sound"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Sound</Trans> },
      ]}
      content={({ bodyClass }) => (
        <div class={`box ${`${bodyClass}`} gap-5`}>
          <MenuSection
            footer={
              <Trans>
                Controls in-app sound effects only. Your device volume is not
                affected.
              </Trans>
            }
          >
            <MenuRow
              title={t`Sound effects`}
              caption={muted() ? t`Muted` : t`On`}
              leading={
                <Dynamic
                  component={muted() ? VolumeXIcon : Volume2Icon}
                  size={ROW_ICON_SIZE}
                  color="icon"
                />
              }
              trailing={
                <Switch
                  value={!muted()}
                  onValueChange={(on) => setMuted(!on)}
                  aria-label={t`Sound effects`}
                  dataSet={{ testid: 'sound-effects-switch' }}
                />
              }
            />
          </MenuSection>
        </div>
      )}
    />
  );
}
