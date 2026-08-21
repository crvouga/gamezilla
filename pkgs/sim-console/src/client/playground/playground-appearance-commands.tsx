import { PaintbrushIcon, RegisterCommand, useThemePreference } from '@pkgs/ui';
import type { ReactNode } from 'react';

/** Theme preference commands for the sim-console command palette. */
export function PlaygroundAppearanceCommands(): ReactNode {
  const { setPreference } = useThemePreference();
  return (
    <>
      <RegisterCommand
        id="theme-light"
        title="Use light theme"
        category="Appearance"
        icon={PaintbrushIcon}
        keywords={['light', 'day', 'bright']}
        run={async () => {
          setPreference('light');
        }}
      />
      <RegisterCommand
        id="theme-dark"
        title="Use dark theme"
        category="Appearance"
        icon={PaintbrushIcon}
        keywords={['dark', 'night']}
        run={async () => {
          setPreference('dark');
        }}
      />
      <RegisterCommand
        id="theme-system"
        title="Use system theme"
        category="Appearance"
        icon={PaintbrushIcon}
        keywords={['system', 'auto', 'os']}
        run={async () => {
          setPreference('system');
        }}
      />
    </>
  );
}
