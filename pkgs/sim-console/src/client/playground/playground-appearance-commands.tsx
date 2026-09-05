import {
  Columns2Icon,
  PaintbrushIcon,
  RegisterCommand,
  SquareStackIcon,
  useThemePreference,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useClientLayoutPreference } from '../debugger/client-layout-preference';

/** Theme + client-layout commands for the sim-console command palette. */
export function PlaygroundAppearanceCommands(): ReactNode {
  const { setPreference } = useThemePreference();
  const { setPreference: setClientLayout } = useClientLayoutPreference();
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
      <RegisterCommand
        id="client-layout-tabs"
        title="Tab clients"
        category="Appearance"
        icon={SquareStackIcon}
        keywords={['tabs', 'clients', 'layout', 'stack']}
        run={async () => {
          setClientLayout('tabs');
        }}
      />
      <RegisterCommand
        id="client-layout-columns"
        title="Column clients"
        category="Appearance"
        icon={Columns2Icon}
        keywords={['columns', 'clients', 'layout', 'side by side']}
        run={async () => {
          setClientLayout('columns');
        }}
      />
    </>
  );
}
