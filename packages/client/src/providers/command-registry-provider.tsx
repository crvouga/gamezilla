import { AppCommands } from '@gamezilla/client/ui/app-commands';
import { CommandPaletteNativeGesture } from '@gamezilla/client/ui/command-palette-native-gesture';
import { PwaUpdatePromptBanner } from '@gamezilla/client/pwa/update-prompt';
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
      <CommandPaletteNativeGesture>
        {children}
        <PwaUpdatePromptBanner />
      </CommandPaletteNativeGesture>
    </CommandRegistryProvider>
  );
}
