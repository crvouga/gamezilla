/**
 * Browser foreground / online signals → sync-engine `AppLifecycle` port.
 * Created once per engine; listeners stay for the document lifetime.
 * Falls back to an always-foreground, always-online port when no DOM exists
 * (test hosts without `document`).
 */

import { createWebAppLifecycle } from '@pkgs/device/web-app-lifecycle';
import type { AppLifecycle } from '@pkgs/sync-engine/client';

type BrowserGlobals = {
  document?: {
    visibilityState: string;
    addEventListener(type: string, listener: () => void): void;
  };
  window?: {
    navigator?: { onLine?: boolean };
    addEventListener(type: string, listener: () => void): void;
  };
};

function alwaysForegroundLifecycle(): AppLifecycle {
  return {
    isForeground: () => true,
    isOnline: () => true,
    subscribe: () => () => undefined,
  };
}

export function createAppSyncLifecycle(): AppLifecycle {
  const globals = globalThis as unknown as BrowserGlobals;
  const doc = globals.document;
  const win = globals.window;
  if (doc === undefined || win === undefined) {
    return alwaysForegroundLifecycle();
  }
  return createWebAppLifecycle({
    document: doc,
    window: {
      navigator: win.navigator,
      addEventListener: win.addEventListener.bind(win),
    },
  });
}
