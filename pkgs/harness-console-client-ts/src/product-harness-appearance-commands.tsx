import { PaintbrushIcon } from '@pkgs/ui-root-client-ts/icons';
import { RegisterCommand } from '@pkgs/ui-root-client-ts/register-command';
import { useThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import type { JSX } from 'solid-js';

/** Theme commands for the harness-console command palette. */
export function ProductHarnessAppearanceCommands(): JSX.Element {
  const themePreference = useThemePreference();
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
    </>
  );
}
