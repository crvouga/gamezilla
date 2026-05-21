import { PwaUpdatePromptBanner } from '@gamezilla/client/pwa/update-prompt';
import { AppCommands } from '@gamezilla/client/ui/app-commands';
import { CommandPalette, CommandRegistryProvider } from '@gamezilla/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';

export function CommandRegistryProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <CommandRegistryProvider storage={AsyncStorage}>
      <AppCommands />
      <CommandPalette />
      {children}
      <PwaUpdatePromptBanner />
    </CommandRegistryProvider>
  );
}
