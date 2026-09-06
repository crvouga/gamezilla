// @io-wall-ok
/**
 * Wall browser device adapters — the only module that reads `window`,
 * `document`, and `navigator` for device ports. Composition roots call these
 * once and inject the resulting ports.
 */

import type { AppLifecycle } from '@pkgs/sync-engine/client';
import {
  createVibrationHaptics,
  type HapticsPort,
  noopHaptics,
} from './haptics';
import type { NetworkStatePort } from './network-state';
import { createWebAppLifecycle } from './web-app-lifecycle';
import { createWebNetworkStatePort } from './web-network-state';

type BrowserGlobals = {
  navigator?: {
    onLine?: boolean;
    connection?: { type?: string };
    vibrate?: (pattern: number | readonly number[]) => boolean;
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
