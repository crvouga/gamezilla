import { useCommandPalette } from '@pkgs/ui-rn';
import { useEffect } from 'react';

import { useDevMenuPort } from '../device/device-ports-provider';

declare const __DEV__: boolean;

/**
 * Registers an Expo Dev Menu action to open the command palette.
 * Keyboard shortcuts (`mod+k`) are web-only; this is the native entry point
 * (iOS Simulator / device via shake or ⌘D).
 */
export function CommandPaletteDevMenu(): null {
  const { open } = useCommandPalette();
  const devMenu = useDevMenuPort();

  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    void devMenu.registerItems([
      {
        name: 'Open Command Palette',
        callback: open,
        shouldCollapse: true,
      },
    ]);
  }, [open, devMenu]);

  return null;
}
