import { PwaUpdatePromptBanner } from '@apps/client/pwa/update-prompt';
import { AppCommands } from '@apps/client/ui/app-commands';
import { CommandPalette, CommandRegistryProvider } from '@pkgs/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';

// AsyncStorage key for the command-palette MRU history. Pinned explicitly so
// existing installs don't lose their history when @pkgs/ui's neutral default
// key changes.
// eslint-disable-next-line lingui/no-unlocalized-strings -- AsyncStorage key, not user-facing.
const COMMAND_HISTORY_STORAGE_KEY = '@gamezilla/command-history';

export function CommandRegistryProviderWrapper({
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
      {children}
      <PwaUpdatePromptBanner />
    </CommandRegistryProvider>
  );
}
