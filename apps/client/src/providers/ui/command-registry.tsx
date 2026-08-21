import { useEmbeddedApp } from '@apps/client/providers/embedded-app-context';
import { PwaUpdatePromptBanner } from '@apps/client/pwa/update-prompt';
import { AppCommands } from '@apps/client/ui/app-commands';
import {
  CommandPalette,
  CommandRegistryProvider,
  useKeyboardShortcutScopeOptional,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import { CommandPaletteDevMenu } from '../../dev/command-palette-dev-menu';

export function AppCommandRegistry({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const embedded = useEmbeddedApp();
  const scope = useKeyboardShortcutScopeOptional();
  return (
    <CommandRegistryProvider enableDefaultShortcuts={scope ?? !embedded}>
      <AppCommands />
      <CommandPalette />
      <CommandPaletteDevMenu />
      {children}
      {embedded ? null : <PwaUpdatePromptBanner />}
    </CommandRegistryProvider>
  );
}
