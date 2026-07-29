import { PwaUpdatePromptBanner } from '@apps/client/pwa/update-prompt';
import { AppCommands } from '@apps/client/ui/app-commands';
import { CommandPalette, CommandRegistryProvider } from '@pkgs/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';

import { CommandPaletteDevMenu } from '../../dev/command-palette-dev-menu';

const COMMAND_HISTORY_STORAGE_KEY = '@app/command-history';

export function AppCommandRegistry({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <CommandRegistryProvider
      storage={AsyncStorage}
      storageKey={COMMAND_HISTORY_STORAGE_KEY}
    >
      <AppCommands />
      <CommandPalette />
      <CommandPaletteDevMenu />
      {children}
      <PwaUpdatePromptBanner />
    </CommandRegistryProvider>
  );
}
