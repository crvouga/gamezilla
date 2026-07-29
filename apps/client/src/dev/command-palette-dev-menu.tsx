import { useCommandPalette } from '@pkgs/ui';
import { registerDevMenuItems } from 'expo-dev-client';
import { useEffect } from 'react';

declare const __DEV__: boolean;

/**
 * Registers an Expo Dev Menu action to open the command palette.
 * Keyboard shortcuts (`mod+k`) are web-only; this is the native entry point
 * (iOS Simulator / device via shake or ⌘D).
 */
export function CommandPaletteDevMenu(): null {
  const { open } = useCommandPalette();

  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    void registerDevMenuItems([
      {
        name: 'Open Command Palette',
        callback: open,
        shouldCollapse: true,
      },
    ]);
  }, [open]);

  return null;
}
