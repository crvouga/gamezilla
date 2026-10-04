/** @jsxImportSource solid-js */
/**
 * `/more/theme` — light / dark / system appearance picker persisted through
 * `ThemePreferenceProvider` (kv-backed).
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-client/create-icon';
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from '@pkgs/ui-client/icons';
import { MenuRow } from '@pkgs/ui-client/menu-row';
import { MenuSection } from '@pkgs/ui-client/menu-section';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import type { ThemePreference } from '@pkgs/ui-client/theme-preference';
import { useThemePreference } from '@pkgs/ui-client/theme-preference';
import { type Accessor, For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

const ROW_ICON_SIZE = 20;
const CHECK_SIZE = 20;

type ThemeOption = {
  readonly key: ThemePreference;
  readonly title: string;
  readonly caption: string;
  readonly icon: IconComponent;
};

function useThemeOptions(): Accessor<readonly ThemeOption[]> {
  const { t } = useLingui();
  return () => [
    {
      key: 'light',
      title: t`Light`,
      caption: t`Bright surfaces, dark text`,
      icon: SunIcon,
    },
    {
      key: 'dark',
      title: t`Dark`,
      caption: t`Dim surfaces, light text`,
      icon: MoonIcon,
    },
    {
      key: 'system',
      title: t`System`,
      caption: t`Follows your device appearance`,
      icon: MonitorIcon,
    },
  ];
}

function ThemeOptionRow(props: {
  readonly option: ThemeOption;
  readonly selected: boolean;
  readonly onSelect: (key: ThemePreference) => void;
}): JSX.Element {
  return (
    <MenuRow
      title={props.option.title}
      caption={props.option.caption}
      selected={props.selected}
      leading={
        <Dynamic
          component={props.option.icon}
          size={ROW_ICON_SIZE}
          color={props.selected ? 'tint' : 'icon'}
        />
      }
      trailing={
        <Show
          when={props.selected}
          fallback={<div class="box" style={{ width: `${CHECK_SIZE}px` }} />}
        >
          <CheckIcon size={CHECK_SIZE} color="tint" />
        </Show>
      }
      onClick={() => props.onSelect(props.option.key)}
      dataSet={{ testid: Handles.themeOption(props.option.key) }}
    />
  );
}

export function ThemeSettingsScreen(): JSX.Element {
  const { preference, setPreference } = useThemePreference();
  const options = useThemeOptions();

  return (
    <ScreenBase
      screenId="theme"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Appearance</Trans> },
      ]}
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass} gap-5`}>
          <MenuSection title={<Trans>Theme</Trans>}>
            <For each={options()}>
              {(option) => (
                <ThemeOptionRow
                  option={option}
                  selected={preference() === option.key}
                  onSelect={setPreference}
                />
              )}
            </For>
          </MenuSection>
        </div>
      )}
    />
  );
}
