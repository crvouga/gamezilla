import { PwaUpdatePromptBanner } from '@apps/client/pwa/update-prompt';
import { AppCommands } from '@apps/client/ui/app-commands';
import { CommandPalette, CommandRegistryProvider } from '@pkgs/ui';
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
