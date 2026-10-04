// @io-wall-ok
/**
 * Wall browser device adapters — the only module that reads `window`,
 * `document`, and `navigator` for device ports. Composition roots call these
 * once and inject the resulting ports.
 */

import type { ClipboardPort } from '@pkgs/device-shared/clipboard';
import type { HapticsPort } from '@pkgs/device-shared/haptics';
import {
  createVibrationHaptics,
  noopHaptics,
} from '@pkgs/device-shared/haptics';
import type { NetworkStatePort } from '@pkgs/device-shared/network-state';
import { createWebAppLifecycle } from '@pkgs/device-shared/web-app-lifecycle';
import { createWebNetworkStatePort } from '@pkgs/device-shared/web-network-state';
import type { AppLifecycle } from '@pkgs/sync-engine-shared/app-lifecycle';

type BrowserGlobals = {
  navigator?: {
    onLine?: boolean;
    connection?: { type?: string };
    vibrate?: (pattern: number | readonly number[]) => boolean;
    clipboard?: { writeText(text: string): Promise<void> };
  };
  window?: {
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
  };
  document?: {
    visibilityState: string;
    addEventListener(type: string, listener: () => void): void;
  };
};

function browser(): BrowserGlobals {
  return globalThis as unknown as BrowserGlobals;
}

/** Vibration API when present (mobile browsers); silent elsewhere. */
export function wallWebHaptics(): HapticsPort {
  const nav = browser().navigator;
  const vibrate = nav?.vibrate;
  if (nav === undefined || typeof vibrate !== 'function') return noopHaptics();
  return createVibrationHaptics({
    vibrate: (pattern) => {
      try {
        return vibrate.call(nav, pattern);
      } catch {
        return false;
      }
    },
  });
}

export function wallWebNetworkStatePort(): NetworkStatePort {
  const nav = browser().navigator ?? {};
  const win = browser().window;
  if (win === undefined) {
    throw new Error('wallWebNetworkStatePort: window is not available');
  }
  return createWebNetworkStatePort({ navigator: nav, events: win });
}

export function wallWebAppLifecycle(): AppLifecycle {
  const doc = browser().document;
  const win = browser().window;
  if (doc === undefined || win === undefined) {
    throw new Error('wallWebAppLifecycle: document / window not available');
  }
  return createWebAppLifecycle({
    document: doc,
    window: {
      navigator: browser().navigator,
      addEventListener: win.addEventListener.bind(win),
    },
  });
}

/** Async Clipboard API; rejects when the browser has no clipboard surface. */
export function wallWebClipboard(): ClipboardPort {
  return {
    writeText: (text) => {
      const clipboard = browser().navigator?.clipboard;
      if (clipboard === undefined) {
        return Promise.reject(new Error('clipboard unavailable'));
      }
      return clipboard.writeText(text);
    },
  };
}
