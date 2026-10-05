import {
  Columns2Icon,
  PaintbrushIcon,
  SquareStackIcon,
} from '@pkgs/ui-root-client/icons';
import { RegisterCommand } from '@pkgs/ui-root-client/register-command';
import { useThemePreference } from '@pkgs/ui-root-client/theme-preference';
import type { JSX } from 'solid-js';

import { useClientLayoutPreference } from './client-layout-preference';

/** Theme + client-layout commands for the harness-console command palette. */
export function ProductHarnessAppearanceCommands(): JSX.Element {
  const themePreference = useThemePreference();
  const clientLayout = useClientLayoutPreference();
  return (
    <>
      <RegisterCommand
        id="theme-light"
        title="Use light theme"
        category="Appearance"
        icon={PaintbrushIcon}
        keywords={['light', 'day', 'bright']}
        run={async () => {
          themePreference.setPreference('light');
        }}
      />
      <RegisterCommand
        id="theme-dark"
        title="Use dark theme"
        category="Appearance"
        icon={PaintbrushIcon}
        keywords={['dark', 'night']}
        run={async () => {
          themePreference.setPreference('dark');
        }}
      />
      <RegisterCommand
        id="theme-system"
        title="Use system theme"
        category="Appearance"
        icon={PaintbrushIcon}
        keywords={['system', 'auto', 'os']}
        run={async () => {
          themePreference.setPreference('system');
        }}
      />
      <RegisterCommand
        id="client-layout-tabs"
        title="Tab clients"
        category="Appearance"
        icon={SquareStackIcon}
        keywords={['tabs', 'clients', 'layout', 'stack']}
        run={async () => {
          clientLayout.setPreference('tabs');
        }}
      />
      <RegisterCommand
        id="client-layout-columns"
        title="Column clients"
        category="Appearance"
        icon={Columns2Icon}
        keywords={['columns', 'clients', 'layout', 'side by side']}
        run={async () => {
          clientLayout.setPreference('columns');
        }}
      />
    </>
  );
}
