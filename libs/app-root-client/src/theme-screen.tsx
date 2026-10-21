/** @jsxImportSource solid-js */
/**
 * `/more/theme` — light / dark / system appearance picker persisted through
 * `ThemePreferenceProvider` (kv-backed).
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-root-client/create-icon';
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from '@pkgs/ui-root-client/icons';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import type { ThemePreference } from '@pkgs/ui-root-client/theme-preference';
import { useThemePreference } from '@pkgs/ui-root-client/theme-preference';
import { type Accessor, For, type JSX } from 'solid-js';
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
        // The check keeps its room on every row, so selecting never reflows.
        <CheckIcon
          size={CHECK_SIZE}
          color={props.selected ? 'tint' : 'transparent'}
        />
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
    <MenuScreen
      screenId="theme"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Appearance</Trans> },
      ]}
    >
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
    </MenuScreen>
  );
}
