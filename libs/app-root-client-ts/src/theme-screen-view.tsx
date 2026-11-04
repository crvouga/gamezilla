/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { ThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
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

export type ThemeSettingsScreenViewProps = {
  /** The appearance currently chosen; its row is marked selected. */
  readonly preference: ThemePreference;
  readonly onSelect: (key: ThemePreference) => void;
};

/**
 * `/more/theme`, presentational: the light / dark / system appearance picker.
 * The chosen appearance and the selection callback arrive as props;
 * `ThemeSettingsScreen` wires them to the persisted theme preference.
 */
export function ThemeSettingsScreenView(
  props: ThemeSettingsScreenViewProps
): JSX.Element {
  const options = useThemeOptions();
  return (
    <MenuScreen
      screenId="theme"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Appearance</Trans> },
      ]}
    >
      <MenuSection title={<Trans>Theme</Trans>}>
        <For each={options()}>
          {(option) => (
            <ThemeOptionRow
              option={option}
              selected={props.preference === option.key}
              onSelect={props.onSelect}
            />
          )}
        </For>
      </MenuSection>
    </MenuScreen>
  );
}
