import { PwaUpdatePromptBanner } from '@apps/client/pwa/update-prompt';
import { AppCommands } from '@apps/client/ui/app-commands';
import { CommandPalette, CommandRegistryProvider } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { CommandPaletteDevMenu } from '../../dev/command-palette-dev-menu';

export function AppCommandRegistry({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <CommandRegistryProvider>
      <AppCommands />
      <CommandPalette />
      <CommandPaletteDevMenu />
      {children}
      <PwaUpdatePromptBanner />
    </CommandRegistryProvider>
  );
}
