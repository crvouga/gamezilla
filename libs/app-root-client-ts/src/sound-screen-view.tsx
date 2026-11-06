/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Volume2Icon, VolumeXIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

const ROW_ICON_SIZE = 20;

export type SoundSettingsScreenViewProps = {
  /** Whether in-app sound effects are muted. */
  readonly muted: boolean;
  readonly onMutedChange: (muted: boolean) => void;
};

/**
 * `/more/sound`, presentational: the in-app sound effects switch. The muted
 * state and its setter arrive as props; `SoundSettingsScreen` wires them to
 * the persisted sounds preference.
 */
export function SoundSettingsScreenView(
  props: SoundSettingsScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuScreen
      screenId="sound"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Sound</Trans> },
      ]}
    >
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
          caption={props.muted ? t`Muted` : t`On`}
          leading={
            <Dynamic
              component={props.muted ? VolumeXIcon : Volume2Icon}
              size={ROW_ICON_SIZE}
              color="icon"
            />
          }
          trailing={
            <Switch
              value={!props.muted}
              onValueChange={(on) => props.onMutedChange(!on)}
              aria-label={t`Sound effects`}
              dataSet={{ testid: Handles.soundEffectsSwitch }}
            />
          }
        />
      </MenuSection>
    </MenuScreen>
  );
}
